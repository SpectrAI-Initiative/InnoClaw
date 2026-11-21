---
name: comprehensive-variant-annotation
description: "Given an rsID, query multiple databases (dbSNP, FAVOR, GWAS Catalog, ClinVar, gnomAD, PharmGKB, ClinGen) for comprehensive annotation. Use when user asks a general question about a variant without specifying which aspect."
license: MIT license
metadata:
    skill-author: PJLab
---

# Comprehensive Variant Annotation

## Usage

### 1. Tool Descriptions

This skill chains 7 public genomics database APIs sequentially to build a comprehensive annotation for a given variant. Use this when the user asks a general/vague question like "帮我查一下 rs7412" or "tell me about rs7412".

**Tool 1: dbSNP — Variant Basic Info & ClinVar RCV Records**

```tex
Query NCBI dbSNP REST API to get SNP basic information and ClinVar clinical records.
API: GET https://api.ncbi.nlm.nih.gov/variation/v0/refsnp/{rsid_number}
Args:
    rs_id (str): dbSNP rsID (e.g. "rs7412")
Return:
    primary_snapshot_data: allele_annotations (gene associations, functional impact,
        ClinVar RCV clinical records), placements_with_allele (GRCh38 coordinates).
```

**Tool 2: FAVOR — Functional Annotation & Scores**

```tex
Query FAVOR (GenoHub) API to get functional annotation and conservation scores.
API: GET https://api.genohub.org/v1/rsids/{rsid}
Return:
    Functional prediction scores (CADD, REVEL, etc.), conservation scores,
    gene annotations, variant effect predictions, and variant_id for gnomAD.
```

**Tool 3: gnomAD — Population Allele Frequency**

```tex
Query gnomAD GraphQL API for population allele frequencies.
API: POST https://gnomad.broadinstitute.org/api
Note: Requires variant_id (chr-pos-ref-alt format) from FAVOR Step 2.
Return:
    Allele frequencies across populations (global, AFR, AMR, ASJ, EAS, FIN, NFE, SAS, etc.)
```

**Tool 4: GWAS Catalog — Trait Associations**

```tex
Query EBI GWAS Catalog REST API for GWAS statistical associations.
API: GET https://www.ebi.ac.uk/gwas/rest/api/associations/search/findByRsId?rsId={rsid}
Return:
    associations: pvalue, risk allele, associated trait/disease, source study.
```

**Tool 5: ClinVar — Clinical Pathogenicity (extracted from dbSNP Step 1)**

```tex
Extract ClinVar RCV records from dbSNP response (already obtained in Step 1).
Return:
    Clinical significance (Pathogenic/Benign/VUS/drug-response),
    review status, associated diseases, RCV accession numbers.
```

**Tool 6: PharmGKB — Pharmacogenomic Annotations**

```tex
Query PharmGKB clinPGx API for drug-gene-variant interactions.
API: GET https://api.clinpgx.org/v1/data/clinicalAnnotation?location.fingerprint={rsid}&view=base
Return:
    Related drugs, evidence level (1A-4), related diseases, annotation types.
```

**Tool 7: ClinGen — Cross-Database ID Mapping**

```tex
Query ClinGen Allele Registry for cross-database identifiers.
API: GET https://reg.genome.network/alleles?dbSNP.rs={rs_id}
Headers: Accept: application/json
Return:
    CA ID, ClinVar IDs, COSMIC ID, gnomAD IDs, external cross-references.
```

### 2. Comprehensive Variant Annotation

Query 7 databases for a given rsID, then save all results into a single JSON file `{rsID}_annotation.json`.

```python
import requests
import json
from datetime import datetime

rs_id = "rs7412"
results = {"query_rsid": rs_id, "timestamp": datetime.now().isoformat()}

def safe_request(name, func, fallback=None):
    """统一的容错请求包装器。任一数据库超时/报错不会中断整个流程。"""
    try:
        return func()
    except requests.exceptions.Timeout:
        print(f"[{name}] ⚠ 连接超时，跳过")
        results.setdefault("errors", {})[name] = "timeout"
        return fallback
    except Exception as e:
        print(f"[{name}] ⚠ 请求失败: {e}，跳过")
        results.setdefault("errors", {})[name] = str(e)
        return fallback

# ── Step 1: dbSNP — 变异基本信息 + ClinVar RCV ──
rsid_num = rs_id.replace("rs", "")
dbsnp_url = f"https://api.ncbi.nlm.nih.gov/variation/v0/refsnp/{rsid_num}"
dbsnp = safe_request("dbSNP",
    lambda: requests.get(dbsnp_url, timeout=30).json(), fallback={})
results["dbsnp"] = dbsnp
print(f"[dbSNP] {rs_id} 查询{'成功' if dbsnp else '失败'}")

# 从 dbSNP 提取 ClinVar RCV 记录（Step 5）
snapshot = dbsnp.get("primary_snapshot_data", {})
clinvar_records = []
for ann in snapshot.get("allele_annotations", []):
    for clin in ann.get("clinical", []):
        clinvar_records.append({
            "accession": clin.get("accession_version", ""),
            "significances": clin.get("clinical_significances", []),
            "diseases": clin.get("disease_names", []),
            "review_status": clin.get("review_status", "")
        })
results["clinvar"] = clinvar_records
print(f"[ClinVar] RCV 记录数: {len(clinvar_records)}")

# ── Step 2: FAVOR — 功能注释与评分 ──
favor_url = f"https://api.genohub.org/v1/rsids/{rs_id}"
favor = safe_request("FAVOR",
    lambda: requests.get(favor_url, timeout=30).json(), fallback={})
results["favor"] = favor
print(f"[FAVOR] 功能注释{'获取成功' if favor else '获取失败'}")

# 从 FAVOR 提取 variant_id 用于 gnomAD 查询
variant_id = None
favor_results = favor if isinstance(favor, list) else favor.get("results", [favor]) if favor else []
if favor_results and isinstance(favor_results, list):
    first = favor_results[0] if favor_results else {}
    chrom = str(first.get("chromosome", ""))
    pos = str(first.get("position", ""))
    ref = first.get("ref", "")
    alt = first.get("alt", "")
    if chrom and pos and ref and alt:
        variant_id = f"{chrom}-{pos}-{ref}-{alt}"

# ── Step 3: gnomAD — 人群等位基因频率 ──
if variant_id:
    gnomad_query = """
    query($variantId: String!) {
      variant(variantId: $variantId, dataset: gnomad_r4) {
        variant_id
        genome {
          ac
          an
          af
          populations { id ac an af }
        }
      }
    }
    """
    gnomad_data = safe_request("gnomAD",
        lambda: requests.post(
            "https://gnomad.broadinstitute.org/api",
            json={"query": gnomad_query, "variables": {"variantId": variant_id}},
            timeout=30
        ).json(), fallback={})
    results["gnomad"] = (gnomad_data or {}).get("data", {}).get("variant", {})
    genome = results["gnomad"].get("genome", {}) if results["gnomad"] else {}
    print(f"[gnomAD] AF={genome.get('af', 'N/A')}")
else:
    results["gnomad"] = {"error": "无法从 FAVOR 提取 variant_id"}
    print("[gnomAD] 跳过: 无 variant_id")

# ── Step 4: GWAS Catalog — 关联表型 ──
gwas_url = f"https://www.ebi.ac.uk/gwas/rest/api/associations/search/findByRsId?rsId={rs_id}"
gwas = safe_request("GWAS Catalog",
    lambda: requests.get(gwas_url, headers={"Accept": "application/json"}, timeout=30).json(),
    fallback={})
associations = (gwas or {}).get("_embedded", {}).get("associations", [])
results["gwas_catalog"] = {
    "association_count": len(associations),
    "associations": associations
}
print(f"[GWAS Catalog] 关联数={len(associations)}")

# ── Step 6: PharmGKB — 药物基因组注释 ──
pgx_url = f"https://api.clinpgx.org/v1/data/clinicalAnnotation?location.fingerprint={rs_id}&view=base"
pgx_resp = safe_request("PharmGKB",
    lambda: requests.get(pgx_url, timeout=30).json(), fallback=[])
pgx_annotations = pgx_resp if isinstance(pgx_resp, list) else (pgx_resp or {}).get("data", [])
results["pharmgkb"] = pgx_annotations
print(f"[PharmGKB] 药物基因组注释数: {len(pgx_annotations)}")

# ── Step 7: ClinGen — 跨数据库 ID 映射 ──
# 注意: ClinGen Allele Registry 服务器可能响应较慢，使用 60s 超时 + 重试
clingen_url = f"https://reg.genome.network/alleles?dbSNP.rs={rs_id}"
clingen_resp = None
for attempt in range(2):  # 最多重试 1 次
    clingen_resp = safe_request("ClinGen",
        lambda: requests.get(clingen_url,
            headers={"Accept": "application/json"}, timeout=60).json(),
        fallback=None)
    if clingen_resp is not None:
        break
    print(f"[ClinGen] 第 {attempt+1} 次尝试失败，重试中...")

if clingen_resp is not None:
    if not isinstance(clingen_resp, list):
        clingen_resp = [clingen_resp]
    # 过滤同义变异
    clingen_alleles = []
    for allele in clingen_resp:
        titles = allele.get("communityStandardTitle", [])
        if titles and any("=" in t for t in titles):
            continue
        clingen_alleles.append({
            "ca_id": allele.get("@id", "").split("/")[-1],
            "title": titles,
            "externalRecords": allele.get("externalRecords", {})
        })
    results["clingen"] = clingen_alleles
    print(f"[ClinGen] 等位基因数: {len(clingen_alleles)}")
else:
    results["clingen"] = {"error": "ClinGen API 连接超时，可稍后单独使用 variant-cross-database-ids skill 重试"}
    print("[ClinGen] ⚠ 所有尝试均超时，已跳过")

# ── 保存结果到 JSON 文件 ──
output_file = f"{rs_id}_annotation.json"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

# 汇总报告
errors = results.get("errors", {})
if errors:
    print(f"\n⚠ 以下数据库查询失败: {list(errors.keys())}，其余数据库结果正常")
print(f"✓ 结果已保存: {output_file}")
```

---
name: gene-knowledge-integration
description: Given a gene symbol (e.g. TPMT), query 3 public databases (ClinGen CAR, PharmGKB, Monarch) to obtain gene registry info, FDA drug labels, clinical annotations, and gene-phenotype associations. Save all results into a JSON file.
license: MIT license
metadata:
    skill-author: PJLab
---

# Gene Knowledge Integration

## Usage

### 1. Tool Descriptions

This skill chains 3 public genomics/pharmacogenomics database APIs sequentially to build a comprehensive pharmacogenomics profile for a given gene.

**Tool 1: ClinGen CAR — Gene Registry Info**

```tex
Query ClinGen Allele Registry API to get gene registration information.
API: GET https://reg.genome.network/gene?HGNC.symbol={gene_symbol}
Args:
    gene_symbol (str): HGNC gene symbol (e.g. "TPMT")
Return:
    Gene record (dict): Contains @id (GN id), locus (genomic coordinates),
        externalRecords (HGNC id/name/symbol, NCBI gene id, MANE transcripts).
```

**Tool 2: PharmGKB (ClinPGx) — Gene Info, FDA Labels & Clinical Annotations**

```tex
Query PharmGKB ClinPGx API to get pharmacogenomics information.
API (gene):   GET https://api.clinpgx.org/v1/data/gene?symbol={gene_symbol}&view=base
API (labels): GET https://api.clinpgx.org/v1/data/label?source=fda&relatedGenes.symbol={gene_symbol}&view=base
API (clin):   GET https://api.clinpgx.org/v1/data/clinicalAnnotation?location.genes.symbol={gene_symbol}&view=base
Args:
    gene_symbol (str): HGNC gene symbol (e.g. "TPMT")
Return:
    gene: PharmGKB gene record with accession id, alternate names, cross-references.
    labels: FDA drug labels mentioning this gene (drug name, source, testing level).
    clinicalAnnotations: Clinical annotations linking genotype to phenotype
        (level of evidence, related chemicals, phenotype categories).
```

**Tool 3: Monarch Initiative — Gene-Phenotype Associations**

```tex
Query Monarch Initiative API to get gene-to-phenotype associations.
API: GET https://api-v3.monarchinitiative.org/v3/api/entity/{hgnc_id}/biolink:GeneToPhenotypicFeatureAssociation
Args:
    hgnc_id (str): HGNC identifier (e.g. "HGNC:12014" for TPMT)
Return:
    items (list): Each item contains subject (gene), object (phenotype HP term),
                  object_label (phenotype name), evidence_types, publications.
```

### 2. Gene Knowledge Integration

Query 3 databases (ClinGen CAR → PharmGKB → Monarch) for a given gene symbol, then save all results into a single JSON file `{gene_symbol}_knowledge.json`.

```python
import requests
import json
from datetime import datetime

gene_symbol = "TPMT"
results = {"query_gene": gene_symbol, "timestamp": datetime.now().isoformat()}

# ── Step 1: ClinGen CAR — 基因注册信息 ──
# 调用 ClinGen Allele Registry API，获取基因的 GN id、基因组坐标、
# HGNC/NCBI 外部记录和 MANE 转录本信息。
car_url = f"https://reg.genome.network/gene?HGNC.symbol={gene_symbol}"
car_resp = requests.get(car_url, headers={"Accept": "application/json"}, timeout=30)
car = car_resp.json()
results["clingen_car"] = car
hgnc_id = car.get("externalRecords", {}).get("HGNC", {}).get("id", "")
print(f"[ClinGen CAR] 基因={gene_symbol}, GN_id={car.get('@id','')}, HGNC={hgnc_id}")

# ── Step 2a: PharmGKB — 基因信息 ──
# 调用 PharmGKB ClinPGx API，获取基因的药物基因组学基本信息。
pgx_gene_url = f"https://api.clinpgx.org/v1/data/gene?symbol={gene_symbol}&view=base"
pgx_gene_resp = requests.get(pgx_gene_url, timeout=30)
pgx_gene = pgx_gene_resp.json()
results["pharmgkb_gene"] = pgx_gene
print(f"[PharmGKB] 基因信息获取成功")

# ── Step 2b: PharmGKB — FDA 药物标签 ──
# 查询与该基因相关的 FDA 药物标签，了解哪些药物的说明书提到了该基因。
pgx_label_url = (
    f"https://api.clinpgx.org/v1/data/label"
    f"?source=fda&relatedGenes.symbol={gene_symbol}&view=base"
)
pgx_labels_resp = requests.get(pgx_label_url, timeout=30)
pgx_labels = pgx_labels_resp.json()
results["pharmgkb_fda_labels"] = pgx_labels
print(f"[PharmGKB] FDA药物标签获取成功")

# ── Step 2c: PharmGKB — 临床注释 ──
# 查询该基因相关的临床注释，包含基因型-表型关联的证据等级。
pgx_clin_url = (
    f"https://api.clinpgx.org/v1/data/clinicalAnnotation"
    f"?location.genes.symbol={gene_symbol}&view=base"
)
pgx_clin_resp = requests.get(pgx_clin_url, timeout=30)
pgx_clin = pgx_clin_resp.json()
results["pharmgkb_clinical_annotations"] = pgx_clin
print(f"[PharmGKB] 临床注释获取成功")

# ── Step 3: Monarch — 基因表型关联 ──
# 调用 Monarch Initiative API，获取该基因关联的表型（HPO terms），
# 需要使用 Step 1 中获取的 HGNC id。
if hgnc_id:
    monarch_url = (
        f"https://api-v3.monarchinitiative.org/v3/api/entity/{hgnc_id}"
        f"/biolink:GeneToPhenotypicFeatureAssociation"
    )
    monarch_resp = requests.get(monarch_url, timeout=30)
    monarch = monarch_resp.json()
    items = monarch.get("items", [])
    results["monarch_phenotypes"] = {
        "association_count": len(items),
        "associations": items
    }
    phenotypes = [i.get("object_label", "") for i in items[:5]]
    print(f"[Monarch] 表型关联数={len(items)}, 前5个={phenotypes}")
else:
    results["monarch_phenotypes"] = {"error": "HGNC id not found from ClinGen CAR"}
    print("[Monarch] 跳过: 未获取到 HGNC id")

# ── 保存结果到 JSON 文件 ──
output_file = f"{gene_symbol}_knowledge.json"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
print(f"\n✓ 所有结果已保存: {output_file}")
```

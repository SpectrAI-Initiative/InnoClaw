---
name: variant-cross-database-ids
description: "Query ClinGen Allele Registry to map variant rsID to identifiers in other databases (ClinVar, gnomAD, COSMIC, UniProtKB, OMIM, etc.)."
license: MIT license
metadata:
    skill-author: PJLab
---

# ClinGen Allele Registry — Cross-Database ID Mapping

## Usage

### Tool Description

```tex
Query ClinGen Allele Registry by rsID to get cross-database identifiers.
Maps variant to IDs in ClinVar, gnomAD, COSMIC, UniProtKB, OMIM, etc.
API: GET https://reg.genome.network/alleles?dbSNP.rs={rs_id}
Headers: Accept: application/json
Note: May return multiple alleles (multi-allelic sites); filter out synonymous (reference) alleles.
Args:
    rs_id (str): dbSNP rsID (e.g. "rs7412")
Return:
    CA ID (canonical allele), and cross-references to ClinVar (alleleId, variationId, RCVs),
    gnomAD, COSMIC, UniProtKB, OMIM and other databases.

Return Fields Explanation:
    - CA ID: ClinGen 统一分配的等位基因标准标识符 (e.g. CA127498)
    - communityStandardTitle: HGVS 标准命名 (e.g. NM_000041.2(APOE):c.526C>T (p.Arg176Cys))
    - ClinVarAlleles.alleleId: ClinVar 等位基因内部编号
    - ClinVarAlleles.preferredName: ClinVar 的 HGVS 标准命名（转录本:cDNA变化 + 蛋白变化）
    - ClinVarVariations.variationId: ClinVar 变异条目编号 (= VCV 编号，如 17848 对应 VCV000017848)
    - ClinVarVariations.RCV: 临床评估记录列表，每个 RCV 代表一个独立机构对该变异的临床解读提交
    - COSMIC: COSMIC 肿瘤体细胞变异数据库 ID
    - gnomAD_2/3/4: 各版本 gnomAD 中的 chr-pos-ref-alt 格式 ID
    - ExAC: ExAC（旧版人群频率数据库）中的变异 ID
    - MyVariantInfo_hg19/hg38: MyVariant.info API 使用的 HGVS genomic 格式
    - dbSNP.rs: 对应的 dbSNP rsID 编号
```

### Query Example

```python
import requests, json

rs_id = "rs7412"
url = f"https://reg.genome.network/alleles?dbSNP.rs={rs_id}"
resp = requests.get(url, headers={"Accept": "application/json"}, timeout=30).json()

if not isinstance(resp, list):
    resp = [resp]

print(f"[ClinGen] {rs_id} 对应 {len(resp)} 个等位基因")

for i, allele in enumerate(resp):
    ca_id = allele.get("@id", "").split("/")[-1]  # e.g. CA127498
    titles = allele.get("communityStandardTitle", [])
    # 跳过同义变异（参考等位基因，标题含 "=" 表示无变化）
    if titles and any("=" in t for t in titles):
        print(f"\n── [{i}] CA ID: {ca_id} (同义/参考等位基因，跳过)")
        continue

    print(f"\n── [{i}] CA ID: {ca_id} ──")
    if titles:
        print(f"  标准命名(HGVS): {titles}")

    # 外部数据库交叉引用
    ext = allele.get("externalRecords", {})

    # ClinVar: alleleId = 等位基因编号, preferredName = HGVS命名
    for cv in ext.get("ClinVarAlleles", []):
        print(f"  ClinVar Allele ID: {cv.get('alleleId')}, name: {cv.get('preferredName')}")
    # ClinVar: variationId = VCV编号, RCV = 各机构临床评估记录列表
    for cv in ext.get("ClinVarVariations", []):
        print(f"  ClinVar Variation ID: {cv.get('variationId')}, RCVs: {cv.get('RCV', [])}")

    # COSMIC (肿瘤体细胞变异)
    for c in ext.get("COSMIC", []):
        print(f"  COSMIC: {c.get('id', c)}")

    # gnomAD (人群频率, chr-pos-ref-alt 格式)
    for ver in ["gnomAD_2", "gnomAD_3", "gnomAD_4"]:
        for g in ext.get(ver, []):
            gid = g.get("id", g) if isinstance(g, dict) else g
            print(f"  {ver}: {gid}")

    # dbSNP
    for d in ext.get("dbSNP", []):
        rs = d.get("rs", d) if isinstance(d, dict) else d
        print(f"  dbSNP: rs{rs}")

    # MyVariantInfo (HGVS genomic 格式)
    for ver in ["MyVariantInfo_hg19", "MyVariantInfo_hg38"]:
        for m in ext.get(ver, []):
            mid = m.get("id", m) if isinstance(m, dict) else m
            print(f"  {ver}: {mid}")

    # ExAC (旧版人群频率)
    for e in ext.get("ExAC", []):
        eid = e.get("id", e) if isinstance(e, dict) else e
        print(f"  ExAC: {eid}")
```

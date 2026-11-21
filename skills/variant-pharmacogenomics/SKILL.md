---
name: variant-pharmacogenomics
description: "Query PharmGKB (clinPGx) for pharmacogenomic clinical annotations — how a variant affects drug response, dosing, and adverse reactions."
license: MIT license
metadata:
    skill-author: PJLab
---

# PharmGKB (clinPGx) — Pharmacogenomic Annotations

## Usage

### Tool Description

```tex
Query PharmGKB clinical annotations API to find drug-gene-variant interactions.
Database: PharmGKB / clinPGx (https://www.pharmgkb.org/)
API: GET https://api.clinpgx.org/v1/data/clinicalAnnotation?location.fingerprint={rsid}&view=base
Args:
    rs_id (str): dbSNP rsID (e.g. "rs7412")
Return:
    Clinical annotations: related drugs (chemicals), evidence level (1A/1B/2A/2B/3/4),
    related diseases, gene (APOE etc.), phenotype categories (efficacy/toxicity/dosage/PK),
    related guidelines and FDA labels.

Return Fields Explanation:
    - relatedChemicals: 关联的药物/化合物名称和 PharmGKB ID
    - levelOfEvidence.term: 证据级别 (1A=最强, 有CPIC/DPWG指南; 4=最弱, 个案报告)
    - location.genes: 变异所在基因
    - relatedDiseases: 关联疾病
    - types: 注释类型 (Efficacy=疗效, Toxicity=毒性, Dosage=剂量, PK=药代动力学)
    - relatedGuidelines: 关联的用药指南 (CPIC, DPWG 等)
    - relatedLabels: 关联的 FDA 药品标签
```

### Query Example

```python
import requests

rs_id = "rs7412"
url = f"https://api.clinpgx.org/v1/data/clinicalAnnotation?location.fingerprint={rs_id}&view=base"
resp = requests.get(url, timeout=30).json()

if isinstance(resp, dict) and "data" in resp:
    annotations = resp["data"]
elif isinstance(resp, list):
    annotations = resp
else:
    annotations = []

print(f"[PharmGKB] {rs_id} 药物基因组注释数: {len(annotations)}")

for i, ann in enumerate(annotations):
    # 药物
    drugs = [c.get("name", "") for c in ann.get("relatedChemicals", [])]
    # 证据级别
    evidence = ann.get("levelOfEvidence", {}).get("term", "N/A")
    # 基因
    genes = [g.get("symbol", "") for g in ann.get("location", {}).get("genes", [])]
    # 疾病
    diseases = [d.get("name", "") for d in ann.get("relatedDiseases", [])]
    # 注释类型
    ann_types = ann.get("types", [])

    print(f"\n  [{i+1}] 药物: {drugs}")
    print(f"       证据级别: {evidence}")
    print(f"       基因: {genes}")
    print(f"       类型: {ann_types}")
    if diseases:
        print(f"       疾病: {diseases}")
```

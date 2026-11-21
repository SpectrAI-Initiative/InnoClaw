---
name: variant-clinical-significance
description: "Query NCBI ClinVar for variant clinical pathogenicity classification (Pathogenic/Benign/VUS), review status and associated diseases."
license: MIT license
metadata:
    skill-author: PJLab
---

# ClinVar Clinical Significance

## Usage

### Tool Description

```tex
Query dbSNP refsnp API to extract ClinVar RCV clinical records for a variant.
API: GET https://api.ncbi.nlm.nih.gov/variation/v0/refsnp/{rsid_number}
Args:
    rs_id (str): dbSNP rsID (e.g. "rs7412")
Return:
    ClinVar RCV records: clinical significance (Pathogenic/Benign/VUS/drug-response etc.),
    review status, associated diseases, accession numbers.
```

### Query Example

```python
import requests

rs_id = "rs7412"

# 通过 rsID 查询 dbSNP，提取 ClinVar RCV 记录
rsid_num = rs_id.replace("rs", "")
url = f"https://api.ncbi.nlm.nih.gov/variation/v0/refsnp/{rsid_num}"
resp = requests.get(url, timeout=30).json()
snapshot = resp.get("primary_snapshot_data", {})

for ann in snapshot.get("allele_annotations", []):
    for clin in ann.get("clinical", []):
        accession = clin.get("accession_version", "")
        diseases = clin.get("disease_names", [])
        significances = clin.get("clinical_significances", [])
        review = clin.get("review_status", "")
        print(f"[ClinVar RCV] {accession}: {significances}, diseases={diseases}, review={review}")
```

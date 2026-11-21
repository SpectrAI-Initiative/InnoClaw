---
name: variant-gwas-associations
description: "Query EBI GWAS Catalog for GWAS statistical associations (p-value, effect size, risk allele) between a variant and traits/diseases."
license: MIT license
metadata:
    skill-author: PJLab
---

# EBI GWAS Catalog — Trait Associations

## Usage

### Tool Description

```tex
Query EBI GWAS Catalog REST API to get GWAS association information for a variant.
Database: EBI GWAS Catalog (https://www.ebi.ac.uk/gwas/)
API: GET https://www.ebi.ac.uk/gwas/rest/api/associations/search/findByRsId?rsId={rsid}
Args:
    rs_id (str): dbSNP rsID (e.g. "rs7412")
Return:
    associations (list): Each contains pvalue, risk allele, trait/disease, source study.
```

### Query Example

```python
import requests

rs_id = "rs7412"
url = f"https://www.ebi.ac.uk/gwas/rest/api/associations/search/findByRsId?rsId={rs_id}"
resp = requests.get(url, headers={"Accept": "application/json"}, timeout=30).json()
associations = resp.get("_embedded", {}).get("associations", [])
print(f"[GWAS Catalog] {rs_id} 关联数: {len(associations)}")

for i, assoc in enumerate(associations[:10]):  # 展示前10条
    pval = assoc.get("pvalue", "N/A")
    beta = assoc.get("betaNum", "N/A")
    risk_freq = assoc.get("riskFrequency", "N/A")
    # 获取 trait 名称需要额外请求 _links
    trait_link = assoc.get("_links", {}).get("efoTraits", {}).get("href", "")
    if trait_link:
        trait_resp = requests.get(trait_link, headers={"Accept": "application/json"}, timeout=15).json()
        traits = [t.get("trait", "") for t in trait_resp.get("_embedded", {}).get("efoTraits", [])]
    else:
        traits = ["unknown"]
    print(f"  [{i+1}] p={pval}, beta={beta}, traits={traits}")
```

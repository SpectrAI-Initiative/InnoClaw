---
name: variant-functional-prediction
description: "Query FAVOR API for variant functional prediction scores (CADD, SIFT, PolyPhen, REVEL, etc.) and gene annotation."
license: MIT license
metadata:
    skill-author: PJLab
---

# FAVOR Functional Prediction

## Usage

### Tool Description

```tex
Query FAVOR (GenoHub) API to get variant functional prediction scores.
API: GET https://api.genohub.org/v1/rsids/{rs_id}
Note: Returns a JSON list; use first element.
Args:
    rs_id (str): dbSNP rsID (e.g. "rs7412")
Return:
    Gene name, exonic category, functional prediction scores
    (CADD, SIFT, PolyPhen2, MutationTaster, GERP, etc.)
```

### Query Example

```python
import requests

rs_id = "rs7412"
url = f"https://api.genohub.org/v1/rsids/{rs_id}"
resp = requests.get(url, timeout=30).json()
d = resp[0] if isinstance(resp, list) else resp

print(f"[FAVOR] variant: {d.get('variant_vcf')}")
print(f"[FAVOR] 基因: {d.get('genecode_comprehensive_info')}")
print(f"[FAVOR] 区域: {d.get('genecode_comprehensive_category')}")
print(f"[FAVOR] 外显子变异类别: {d.get('genecode_comprehensive_exonic_category')}")
print(f"[FAVOR] CADD phred: {d.get('cadd_phred')} (>20=有害)")
print(f"[FAVOR] SIFT: {d.get('sift_cat')} (val={d.get('sift_val')})")
print(f"[FAVOR] PolyPhen2 HDIV: {d.get('polyphen2_hdiv_score')}")
print(f"[FAVOR] PolyPhen2 HVAR: {d.get('polyphen2_hvar_score')}")
print(f"[FAVOR] MutationTaster: {d.get('mutation_taster_score')}")
print(f"[FAVOR] MutationAssessor: {d.get('mutation_assessor_score')}")
print(f"[FAVOR] MetaSVM pred: {d.get('metasvm_pred')}")
print(f"[FAVOR] GERP_N: {d.get('gerp_n')}, GERP_S: {d.get('gerp_s')}")
print(f"[FAVOR] BRAVO AF: {d.get('bravo_af')}")
```

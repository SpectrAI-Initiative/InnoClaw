---
name: variant-population-frequency
description: "Query gnomAD for variant allele frequency across populations. Uses FAVOR to convert rsID→variant_id first, then queries gnomAD. "
license: MIT license
metadata:
    skill-author: PJLab
---

# gnomAD Population Frequency

## Usage

### Tool Description

```tex
Step 1: Query FAVOR to convert rsID → chr-pos-ref-alt format.
API: GET https://api.genohub.org/v1/rsids/{rs_id}
Step 2: Query gnomAD GraphQL API with the variant_id.
API: POST https://gnomad.broadinstitute.org/api (GraphQL)
Args:
    rs_id (str): dbSNP rsID (e.g. "rs7412")
Return:
    Overall AF, population-specific AF (exome + genome), homozygote counts.
```

### Query Example

```python
import requests

rs_id = "rs7412"

# ── Step 1: FAVOR 获取 variant_id (chr-pos-ref-alt) ──
# 注意：FAVOR 可能返回多个变异（多等位基因位点），需遍历所有结果
favor_url = f"https://api.genohub.org/v1/rsids/{rs_id}"
favor_resp = requests.get(favor_url, timeout=30).json()
if not isinstance(favor_resp, list):
    favor_resp = [favor_resp]

variant_ids = [item.get("variant_vcf", "") for item in favor_resp if item.get("variant_vcf")]
print(f"[FAVOR] 该rsID对应 {len(variant_ids)} 个变异: {variant_ids}")

# ── Step 2: gnomAD 查询人群频率（遍历所有变异） ──
query = """
query VariantQuery($variantId: String!) {
  variant(variantId: $variantId, dataset: gnomad_r4) {
    variant_id
    rsid
    exome {
      ac
      an
      af
      ac_hom
      populations { id ac an ac_hom }
    }
    genome {
      ac
      an
      af
      ac_hom
      populations { id ac an ac_hom }
    }
  }
}
"""

for variant_vcf in variant_ids:
    print(f"\n── 查询 {variant_vcf} ──")
    resp = requests.post(
        "https://gnomad.broadinstitute.org/api",
        json={"query": query, "variables": {"variantId": variant_vcf}},
        timeout=30
    ).json()

    v = resp.get("data", {}).get("variant", {})
    if not v:
        print(f"[gnomAD] {variant_vcf}: 未找到数据")
        continue
    print(f"[gnomAD] variant: {v.get('variant_id')}, rsid: {v.get('rsid')}")

    for source in ["exome", "genome"]:
        d = v.get(source, {})
        if d:
            print(f"[gnomAD] {source}: AF={d.get('af')}, AC={d.get('ac')}, AN={d.get('an')}, Hom={d.get('ac_hom')}")
            for pop in (d.get("populations") or []):
                if pop.get("an", 0) > 0:
                    af = pop["ac"] / pop["an"]
                    print(f"  {pop['id']}: AF={af:.6f}, AC={pop['ac']}, AN={pop['an']}")
```

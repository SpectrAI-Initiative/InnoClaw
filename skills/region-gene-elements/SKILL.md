---
name: region-gene-elements
description: "Query IGVF Catalog for regulatory element–gene associations within a genomic region, including association scores, element types, and biosample context."
license: MIT license
metadata:
    skill-author: PJLab
---

# IGVF Catalog — Regulatory Element–Gene Associations by Region

## Usage

### Tool Description

```tex
Query IGVF Catalog API to find regulatory-element-to-gene associations within a genomic region.
Database: IGVF Catalog (https://api.catalogkg.igvf.org/)
API: GET https://api.catalogkg.igvf.org/api/genomic-elements/genes

Args:
    region (str): Required. Genomic region, e.g. "chr1:903900-904900"
    organism (str): Default "Homo sapiens"
    source_annotation (str, optional): e.g. "enhancer", "intergenic"
    region_type (str, optional): e.g. "accessible dna elements", "tested elements"
    source (str, optional): e.g. "ENCODE_EpiRaction"
    method (str, optional): e.g. "CRISPR FACS screen"
    biosample_name (str, optional): e.g. "placenta"
    verbose (bool): true=返回完整信息, false=精简 (default false)
    page (int): 0-based page
    limit (int): 每页条目数, 最大 500

Return (list of dicts), each item contains:
    - score (float): 调控元件与基因的关联分数
    - source (str): 数据来源 (e.g. "ENCODE")
    - source_url (str): 来源链接
    - genomic_element (dict):
        - chr, start, end: 调控元件基因组坐标
        - source_annotation: 元件注释类型 (intergenic, enhancer, promoter 等)
        - type: 元件类型 (accessible dna elements, tested elements 等)
    - gene (dict):
        - _id: Ensembl Gene ID (e.g. "ENSG00000187634")
        - name: 基因名 (e.g. "SAMD11")
        - chr, start, end, strand: 基因坐标
        - gene_type: 基因类型 (protein_coding, lncRNA 等)
        - hgnc: HGNC ID (e.g. "HGNC:28706")
        - entrez: Entrez ID (e.g. "ENTREZ:148398")
    - biosample (str): 来源生物样本 (e.g. "natural killer cell...")
    - method (str): 实验方法 (e.g. "CRISPR FACS screen")
```

### Query Example

```python
import requests

region = "chr1:903900-904900"
url = "https://api.catalogkg.igvf.org/api/genomic-elements/genes"
params = {
    "region": region,
    "organism": "Homo sapiens",
    "verbose": "true",
    "page": 0,
}
resp = requests.get(url, params=params, timeout=30).json()

print(f"[IGVF] 区域 {region} 内调控元件-基因关联: {len(resp)} 条")

for i, item in enumerate(resp[:10]):
    gene = item.get("gene", {})
    elem = item.get("genomic_element", {})
    print(f"\n  [{i+1}] 基因: {gene.get('name', 'N/A')} ({gene.get('_id', '')})")
    print(f"       基因坐标: {gene.get('chr')}:{gene.get('start')}-{gene.get('end')} ({gene.get('strand')})")
    print(f"       基因类型: {gene.get('gene_type', '')}")
    print(f"       调控元件: {elem.get('chr')}:{elem.get('start')}-{elem.get('end')}")
    print(f"       元件类型: {elem.get('type', '')} ({elem.get('source_annotation', '')})")
    print(f"       关联分数: {item.get('score', 'N/A')}")
    print(f"       来源: {item.get('source', '')}, 方法: {item.get('method', '')}")
    print(f"       样本: {item.get('biosample', '')[:60]}")
```

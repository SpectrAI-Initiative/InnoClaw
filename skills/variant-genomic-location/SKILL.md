---
name: variant-genomic-location
description: "Query dbSNP + NCBI Gene to get variant genomic position (chromosome, coordinates, ref/alt alleles, mutation type) and associated gene coordinates."
license: MIT license
metadata:
    skill-author: PJLab
---

# dbSNP Variant Query

## Usage

### Tool Description

```tex
Step 1: Query NCBI dbSNP REST API to get variant position, ref/alt alleles, gene association.
API: GET https://api.ncbi.nlm.nih.gov/variation/v0/refsnp/{rsid_number}

Step 2: Query NCBI Gene API to get the full coordinate range of the associated gene.
API: GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gene&id={gene_id}&retmode=json

Args:
    rs_id (str): dbSNP rsID (e.g. "rs7412")
Return:
    染色体, 突变位置(0-based start/end), 突变类型(SNV/insertion/deletion),
    ref/alt等位基因, 关联基因名称及其完整坐标范围.
```

### Query Example

```python
import requests

rs_id = "rs7412"

# ── Step 1: dbSNP 查询变异信息 ──
url = f"https://api.ncbi.nlm.nih.gov/variation/v0/refsnp/{rs_id.replace('rs','')}"
resp = requests.get(url, timeout=30).json()
snapshot = resp.get("primary_snapshot_data", {})
variant_type = snapshot.get("variant_type", "unknown")  # snv, ins, del 等

# 提取 GRCh38 坐标
chrom, start, end, ref, alt, hgvs = "", 0, 0, "", "", ""
for p in snapshot.get("placements_with_allele", []):
    for trait in p.get("placement_annot", {}).get("seq_id_traits_by_assembly", []):
        if "GRCh38" in trait.get("assembly_name", ""):
            for allele in p.get("alleles", []):
                spdi = allele.get("allele", {}).get("spdi", {})
                r = spdi.get("deleted_sequence", "")
                a = spdi.get("inserted_sequence", "")
                if r != a:
                    chrom = spdi.get("seq_id", "")
                    start = spdi.get("position", 0)
                    ref, alt = r, a
                    end = start + len(ref)
                    hgvs = allele.get("hgvs", "")

# 判断突变类型
if len(ref) == 1 and len(alt) == 1:
    mut_type = f"SNV (替换: {ref}→{alt})"
elif len(ref) > len(alt):
    mut_type = f"Deletion (缺失: 丢失{len(ref)-len(alt)}个碱基)"
elif len(ref) < len(alt):
    mut_type = f"Insertion (插入: 增加{len(alt)-len(ref)}个碱基)"
else:
    mut_type = f"MNV (多核苷酸替换: {ref}→{alt})"

print(f"[dbSNP] rsID: {rs_id}")
print(f"[dbSNP] 染色体: {chrom}")
print(f"[dbSNP] 突变位置: start={start}, end={end} (0-based)")
print(f"[dbSNP] 突变类型: {mut_type}")
print(f"[dbSNP] HGVS: {hgvs}")

# 提取关联基因 ID 和名称
gene_id, gene_name = None, ""
for ann in snapshot.get("allele_annotations", []):
    for asm in ann.get("assembly_annotation", []):
        for gene in asm.get("genes", []):
            gene_id = gene.get("id")
            gene_name = gene.get("locus", "")
            print(f"[dbSNP] 关联基因: {gene_name} ({gene.get('name','')}), NCBI Gene ID: {gene_id}")
            break
    if gene_id:
        break

# ── Step 2: NCBI Gene 查询基因完整坐标范围 ──
if gene_id:
    gene_url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gene&id={gene_id}&retmode=json"
    gene_resp = requests.get(gene_url, timeout=30).json()
    gene_info = gene_resp.get("result", {}).get(str(gene_id), {})
    for g in gene_info.get("genomicinfo", []):
        g_chr = g.get("chraccver", "")
        g_start = g.get("chrstart", 0)
        g_stop = g.get("chrstop", 0)
        exon_count = g.get("exoncount", 0)
        print(f"[Gene] {gene_name} 完整坐标: {g_chr}:{g_start}-{g_stop} (0-based)")
        print(f"[Gene] 基因长度: {abs(g_stop - g_start) + 1} bp, 外显子数: {exon_count}")
```

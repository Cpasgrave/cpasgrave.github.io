def vertical_histogram_of(s):
    d = {c:s.count(c)for c in sorted({*s})if 64<ord(c)<91}
    h = [' '.join('*' if d[k]>=i else ' 'for k in d.keys()).rstrip()for i in range(max(d.values(),default=0),0,-1)]
    return '\n'.join(h+[' '.join(d.keys())])
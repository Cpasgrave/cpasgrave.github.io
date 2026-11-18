def accum(s):
    list=[(s[i].upper()+s[i].lower()*i) for i in range (len(s))]
    return '-'.join(list)
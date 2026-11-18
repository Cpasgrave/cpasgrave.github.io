find_missing_letter=lambda c:[chr(*{*range(a+1,b)}-{*x})for a,*x,b in [sorted(map(ord,c))]][0]


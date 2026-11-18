from functools import reduce as red

gcd = lambda x,y:y and gcd(y,x%y)or x
solution = lambda a:a[0]if len(a)==1 else red(gcd,set(a))*len(a)
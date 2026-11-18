from functools import lru_cache as cache

@cache(maxsize=1024)
def fac(x): return x and x*fac(x-1) or 1

def listPosition(word):
  lw,chars,res = len(word),set(word),1
  lower = {c:{d for d in chars if c>d}for c in chars}
  for i,c in enumerate(word):
  	end = word[i:]
  	for l in lower[c]&set(end):
  	  num = fac(lw-i-1)
  	  for f in[fac(v-1 if k==l else v)for k,v in{c:end.count(c)for c in set(end)}.items()]:
  	    num //= f
  	  res += num
  return res
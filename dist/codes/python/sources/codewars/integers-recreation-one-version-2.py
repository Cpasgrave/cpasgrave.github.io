def list_squared(m,n):
  res = []
  for N in range(m,n+1):   
    div = set()
    for d in range(1,int(N**.5)+1):
        if N%d==0: 
          m = N//d
          div|={d*d,m*m}
    s = sum(div)
    r = int(s**.5)
    if r*r==s:res.append([N,s])
  return res
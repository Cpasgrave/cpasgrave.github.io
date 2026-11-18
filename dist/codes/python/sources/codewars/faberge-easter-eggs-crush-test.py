def height(n,m,h=[0,1]):
  for i in range(1,n+1) :
    h = [[h[0]+t,t]for t in [h[1]*(m-i+1)//i]][0]
  return h[0]
from math import log
rgsum = lambda a,b:[(a+b)*(b-a+1)//2 for a,b in[(max(0,a),max(0,b))]][0]
def elder_age(m,n,l,t,s=0):
  a,b = m<n and (m,n) or (n,m)
  if a==0: return 0
  a2,b2 = [2**int(log(x,2))for x in(a,b)]
  sl,sb2,b_,a_ = s-l,s+b2,b-b2,a-a2
  r1 = a2*rgsum(sl,sl+b2-1)
  if a2==b2:
    r2 = elder_age(a2,b_,l,t,sb2)+elder_age(a_,b_,l,t,s)
    r3 = (a_)*rgsum(sl+a2,sl+2*a2-1)
  else:
    r2 = elder_age(a,b_,l,t,sb2)
    r3 = (a_)*rgsum(sl,sl+b2-1)
  return (r1+r2+r3)%t
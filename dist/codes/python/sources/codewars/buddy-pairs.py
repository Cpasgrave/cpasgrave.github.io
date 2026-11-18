def divz(x):
    div = {1}
    for i in range(2,int(x**.5)+1):
        if x%i==0:
            div |= {i,x//i}
    return sum(div)-1

def buddy(a,b):
    for m in range(a,b):
        n = divz(m)
        if n<a: continue
        if divz(n)==m: return [m,n]
    return 'Nothing'

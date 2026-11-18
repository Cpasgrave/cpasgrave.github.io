def panel_count(n):
    
    x   = int(n**(1/3))
    tot = -~x*x*x*3
    n  -= x**3
    
    for h,l in ((x,x), (x,x+1), (x+1,x+1)):
        nSq = h*l
        if not n or nSq>n: break
        n -= nSq
        tot += 3*h*l + h + l
    
    x = int(n**.5)
    n -= x**2
    tot += 3*x*x + 2*x
    
    for x in (x,x+1):
        if not n: break
        x = min(x,n)
        n -= x
        tot += 3*x+1
        
    return tot
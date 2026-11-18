def count_to_n(n):
    cfnd = count_for_n_digits = {1:3}
    # 1 digit numbers:
    ct = (n>=0)+(n>=1)+(n>=8)
    sn = str(n)
    dig = len(sn)
    up_do = {i:j for i,j in zip('01689','01986')}
    if dig==1 or n<0: return ct
    # dig-1 digits numbers:
    step = cfnd[2] = 4
    for d in range(2,dig):
        ct += step
        step = cfnd.setdefault(d+1,(d%2==0 and 3 or 5/3)*step)
    # dig digits numbers:
    fac = [1]
    if dig>2: fac = [3 if dig%2 else 5]+fac
    for i in range(2,(dig+1)//2): fac = [fac[0]*5]+fac

    mid = (dig+1)//2
    for i in range(mid):
        sni = sn[i]
        rg = set(range(int(sni)))
        nums = [{1,6,8,9},{0,1,6,8,9},{0,1,8}][(i!=0)+(dig%2 and i==mid-1)]
        ct += fac[i]*len(rg&nums)
        if sni not in '01689': break
        if i==mid-1:
            if dig%2 and sni not in '018': break
            left = ''.join(map(lambda x: up_do[x],sn[:mid]))
            right = int(sn[-mid:])
            if right>=int(left[::-1]): ct += 1

    return ct

def upsidedown(a,b):
    cb = count_to_n(int(b))
    ca = count_to_n(int(a)-1)
    return cb-ca
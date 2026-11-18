MOD = 998244353

inv = [1]+[inv.append(v)or v for inv in[[1]]for i in range(2,80001)for d,m in[divmod(MOD,i)]for v in[d*(i-inv[m-1])+m]]

def height(m,g):
    m=m-1
    coeff = 1
    result = 0
    for i in range(m+1):
        coeff = coeff*(g-i)*inv[i]%MOD
        result += coeff
    return result%MOD

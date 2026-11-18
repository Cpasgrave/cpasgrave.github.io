def sum_of_squares(n):
    is_sq = lambda x: int(x**0.5)**2==x
    if is_sq(n):
        return 1
    while (n&3)==0:
        n>>=2
    if (n&7)==7:
        return 4
    for i in range(1,int(n**0.5)+1):
        if is_sq(n-i*i):
            return 2
    return 3
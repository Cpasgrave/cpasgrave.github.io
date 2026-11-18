def next_bigger(n):
    n = [int(i) for i in str(n)]
    for i in range(2,len(n)+1):
            if n[-i]<n[-i+1]:
                a = n[:-i]
                b = n[-i]
                c = n[-i+1:]
                for j in range(1,len(c)+1):
                    if c[-j]>b:
                        d = c[-j]
                        c.remove(d)
                        r = a + [d] + sorted([b]+c)
                        return int(''.join(map(str,r)))
    return -1

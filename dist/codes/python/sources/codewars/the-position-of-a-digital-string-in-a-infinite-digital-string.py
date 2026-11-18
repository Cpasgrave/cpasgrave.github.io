def position(n):
    l = len(str(n))
    return sum((i)*(10**i-10**(i-1))for i in range(1,l))+(n-10**(l-1))*l

def find_position(x):
    # special case if x is all zeros
    zero = 0
    if set(x)=={'0'}:
        zero = 1
        x = '1'+x
    lx = len(x)
    sol = []
    for i in range(lx):
        # let's cut x at index i
        for ln in range(1,lx+1):
            # let's assume a number n starting at i and with length ln
            # h for n's head
            h = x[i:min(lx,i+ln)]
            n = int(h)
            if ln>lx-i:
                # t for n's tail
                t = x[lx-ln:i]
                le = len(t)
                # special case if tail is all nines
                nine = 10**(le) if set(t)=={'9'} else 0
                n = int(h+'0'*le)-nine+int(t)+1
            # after n is established, let's add numbers before and after it in the champernowne chain
            pre = [n-i for i in range(1,i//ln+2)][::-1]
            if any(n<0 for n in pre): continue
            pre = ''.join(map(str,pre))[-i:] if i else ''
            post = ''.join(map(str,[n+i for i in range(1,(lx-i-ln)//ln+2)]))
            champ = pre+(str(n)+post)[:lx-i]
            # check if it matches
            if x == champ: sol += [position(n)-i+zero]
    # returning best solution
    return None if sol==[] else min(sol)
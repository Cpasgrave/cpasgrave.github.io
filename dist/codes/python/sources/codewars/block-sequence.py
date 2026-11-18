from decimal import Decimal as D

rangesum = lambda x:x*(x+1)/2

def x_index(x,per_dn,dn):

    base = per_dn[dn-1]
    rest = x-10**(dn-1)+1
    return D(base)+D(rest*sum(i*9*10**(i-1) for i in range(1,dn)))+D(rangesum(rest)*dn)

def solve(n):

    # x est l'entier le plus bas pour lequel la série 
    # 112123123412345...(ici 5) contient un nombre de chiffres > n
    digit_number = 0
    index = D(0)
    previous = 0
    per_digit_number = {0:0}
    # la première boucle cherche le nombre de chiffres qui composent x
    while True:
        digit_number += 1
        multiplicator = 9*10**(digit_number-1)
        index = D(previous) + D(multiplicator*sum(i*9*10**(i-1)for i in range(1,digit_number))) + D(digit_number*rangesum(multiplicator))
        per_digit_number[digit_number] = index
        if index>n: break
        previous = index

    # a partir de ce point, le nombre de chiffres de x est connu
    # let's go half by half ...
    lo = D(10**(digit_number-1)-1)
    hi = D(10**(digit_number)-1)
    while hi-lo>1:
        mid = (lo+hi)//2
        test = x_index(mid,per_digit_number,digit_number)
        if test>n: hi = mid
        else: lo = mid

    index = x_index(lo,per_digit_number,digit_number)
    x = lo
    to_go = n-index
    if to_go==0: return int(str(x)[-1])
    # le x qu'on cherchait est donc le 'lo' trouvé.
    # et on a l'index à la fin de cette série (index)

    # reste à chercher y, premier entier pour lequel la série 
    # 123456...(y-1)(y) sera la première série (incomplète)
    # qui, ajoutée à l'index donné par x, mène à l'index n

    # on cherche d'abord le nombre de chiffres de y:
    ydn = 0
    jump = 0
    while True:
        ydn += 1
        test = jump+ydn*9*(10**(ydn-1))
        if test>to_go: break
        jump = test

    # finalement, on peut chercher y
    lo = D(10**(ydn-1))
    hi = D(10**(ydn)-1)
    base = sum(9*i*10**(i-1)for i in range(1,ydn))
    while hi-lo>1:
        mid = (lo+hi)//2
        test = base+ydn*(mid-10**(ydn-1)+1)
        if test>to_go: hi = mid
        else: lo = mid

    idx = base+ydn*(hi-10**(ydn-1)+1)
    diff = int(idx-to_go)
    y = hi
    print(n)
    return int(''.join(str(y-i)for i in range(diff//ydn,-1,-1))[-diff-1])
    
    

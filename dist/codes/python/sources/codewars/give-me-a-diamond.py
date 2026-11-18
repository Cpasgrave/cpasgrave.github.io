def diamond(n):
    return ('\n'.join([(abs(2*x-n-1)//2)*' '+(-abs(2*x-n-1)+n)*'*' for x in range(1,n+1)])+'\n')*(n>0 and n%2)or None
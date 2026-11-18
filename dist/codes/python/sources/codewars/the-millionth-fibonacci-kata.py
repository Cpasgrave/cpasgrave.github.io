import numpy as np

def fib(n):
    if n == 0:return 0
    A = np.matrix([[1,1],[1,0]],dtype=np.object)
    if n>0:
        return (A**(n-1))[0,0]
    else:
        n = -n
        return (A**(n-1))[0,0]*(-1)**(n+1)
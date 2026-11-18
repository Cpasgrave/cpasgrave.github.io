import numpy as np
def knights_tour(start,n):
    f = lambda x,y:8-sum([(i==j or i==n-1-j)*(3-j)for j in [0,1]for i in [x,y]])-sum([(i==0 or i==n-1)and j in range(2,n-2)for i,j in((x,y),(y,x))])
    L = {0:(-1,2),1:(-2,1),2:(-2,-1),3:(-1,-2),4:(1,-2),5:(2,-1),6:(2,1),7:(1,2)}
    W = np.fromfunction(np.vectorize(f),(n,n))
    path = [start]
    while len(path)<n*n:
        W[path[-1]]=0
        ways = [j for j in [(path[-1][0]+L[i][0],path[-1][1]+L[i][1]) for i in range(8)]if all(-1<k<n for k in j)and W[j]>0]
        for i in ways:
            W[i]-=1
        nxt = [ways[i] for i in range(len(ways))if W[ways[i]]==min([W[ways[j]]for j in range(len(ways))])][0]
        path.append(nxt)
    return path
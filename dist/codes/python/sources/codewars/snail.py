import numpy as np
def snail(arr):
    arr = np.array(arr)
    list=[]
    while len(arr):
        list.extend(arr[0,:])
        arr=arr[1:,:]
        arr=np.rot90(arr)
    return list
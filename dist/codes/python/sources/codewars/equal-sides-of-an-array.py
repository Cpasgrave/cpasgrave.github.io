def find_even_index(arr):
    left,right = 0,sum(arr)
    for i,ai in enumerate(arr):
    	right -=ai
    	if left==right: return i
    	left += ai
    return -1
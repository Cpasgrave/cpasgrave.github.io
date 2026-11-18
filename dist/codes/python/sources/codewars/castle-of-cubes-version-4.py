def panel_count(n):
    root3 = int(n**(1/3))
    dim3 = [0,0,0] if not n else [root3]*3 if n<root3**2*(root3+1) else [root3,root3,root3+1] if n<root3*(root3+1)**2 else [root3,root3+1,root3+1]
    remain2 = n - dim3[0]*dim3[1]*dim3[2]
    root2 = int(remain2**(1/2))
    dim2 = [0,0] if not remain2 else [root2]*2 if remain2<root2*(root2+1) else [root2,root2+1]
    dim1 = remain2 - dim2[0]*dim2[1]
    surface3 = 2 * (dim3[0]*dim3[1]+dim3[1]*dim3[2]+dim3[2]*dim3[0])
    int3 = (dim3[0]*dim3[1]*dim3[2]*6 - surface3)//2
    surface2 = (dim2[0]+2)*(dim2[1]+2)-4
    int2 = (dim2[0]*dim2[1]*5 - surface2)//2
    surfint1 = dim1*3 + 1*bool(dim1)
    return surface3+int3+surface2+int2+surfint1
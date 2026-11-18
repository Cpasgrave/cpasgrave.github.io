def path_finder(maze):
    M = [list(i) for i in maze.split('\n')]
    rows,cols = len(M),len(M[0])
    visited = {(0,0)}
    paths = [[(0,0)]]
    while paths:
        for p in paths:
            if p[-1]==(rows-1,cols-1):return True
            for i in [(-1,0),(0,-1),(1,0),(0,1)]:
                step = p[-1][0]+i[0],p[-1][1]+i[1]
                if -1<step[0]<rows and -1<step[1]<cols and step not in visited and M[step[0]][step[1]]!='W':
                    visited.add(step)
                    paths.append(p+[step])
            paths.remove(p)
    return False
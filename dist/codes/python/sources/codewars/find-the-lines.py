def check_grid(grid, pos, size):
    x = pos[0]
    y = pos[1]
    row = grid[y]
    col = [grid[i][x] for i in range(size)]
    tl_br = [grid[y+i][x+i] for i in range(-min([x, y]), min([size-x, size-y]))]
    tr_bl = [grid[y+i][x-i] for i in range(-min([size-1-x, y]), min([x+1, size-y]))]
    return([row, col, tl_br, tr_bl])
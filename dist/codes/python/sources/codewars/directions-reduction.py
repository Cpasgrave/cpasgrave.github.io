def dirReduc(arr):
    path = ""
    for i in arr:
        path += i[0]
    arr = []
    while "EW" in path or "WE" in path or "SN" in path or "NS" in path:
        path = path.replace("EW", "")
        path = path.replace("WE", "")
        path = path.replace("SN", "")
        path = path.replace("NS", "")
    for i in path:
        if i == "N": arr.append("NORTH")
        if i == "S": arr.append("SOUTH")
        if i == "E": arr.append("EAST")
        if i == "W": arr.append("WEST")
    return arr
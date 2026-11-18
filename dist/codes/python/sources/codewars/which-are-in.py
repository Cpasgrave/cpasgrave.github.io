def in_array(array1, array2):
    array = list(set( i for i in array1 if i in " ".join(array2)))
    array.sort()
    return array
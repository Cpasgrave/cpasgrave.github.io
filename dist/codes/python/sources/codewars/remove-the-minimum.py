def remove_smallest(numbers):
    if numbers == []:
        numbers.append(0)
    n = numbers.index(min(numbers))
    return numbers[:n]+numbers[n+1:]
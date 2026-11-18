using System;
using static System.Math;

public class S
{
    public static double Solve(double m)
    {
        return (2*m+1-Pow(4*m+1,0.5))/2/m;
    }
}
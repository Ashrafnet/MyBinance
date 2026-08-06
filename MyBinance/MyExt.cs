using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace MyBinance
{
    public static class MyExt
    {
        public static void DoubleBufferList(this ListView listView)
        {
            GUI.StableListView.DoubleBufferListView(listView.Handle);
        }
        public static string ToUSDTValue(this decimal x)
        {
            return "$" + x.ToGroupedThounsands();//d.ToString("N", nfi)

        }

        public static string ToGroupedThounsands(this decimal x)
        {
            var nfi = new NumberFormatInfo();
            nfi.NumberDecimalSeparator = ".";
            nfi.NumberGroupSeparator = ",";
            nfi.NumberDecimalDigits = 6;
            return x.ToString("N", nfi);//d.ToString("N", nfi)

        }
        public static string ToBTCValue(this decimal x)
        {
            return x.ToString("0.00000000") + " btc";

        }

        public static string ToPercentage(this decimal x)
        {
            return "" + x.ToString("00.00") + "%";

        }

        public static decimal? ToDecimalOrNull(this string x)
        {
            if (string.IsNullOrWhiteSpace(x))
                return null;
            x = x.Trim().Replace("$", "").Replace("_", "").Replace("btc","");
            var b = decimal.TryParse(x, out decimal d);
            if (b)
                return d;

            return null;
        }
        public static decimal ToDecimalOrZero(this string x)
        {
            if (string.IsNullOrWhiteSpace(x))
                return 0;
            x = x.Trim().Replace("$", "").Replace("_", "").Replace("btc", "");
            var b = decimal.TryParse(x, out decimal d);
            if (b)
                return d;

            return 0;
        }
    }
}

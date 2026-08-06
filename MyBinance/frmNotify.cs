using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace MyBinance
{
    public partial class frmNotify : formBase
    {
        Form1 mainform = null;
        public frmNotify(Form1 form)
        {
            mainform = form;
            mainform.OnNewPriceAction += Mainform_OnNewPriceAction;
            InitializeComponent();
        }

        private void Mainform_OnNewPriceAction(IEnumerable<Binance.Net.Interfaces.IBinanceMiniTick> arg1, decimal arg2, decimal arg3)
        {
            RefreshPricesUI( arg2, arg3);
        }
        private void RefreshPricesUI(decimal arg2, decimal arg3)
        {
            if (InvokeRequired)
            {
                Invoke(new Action<decimal, decimal>(RefreshPricesUI), new object[] { arg2, arg3 });
                return;
            }
            lblBTCPrice.Text = "BTC Price " + arg2.ToString("C");
            lblBTCPrice.Text += $"{Environment.NewLine }Accounts {arg3:C}";
        }

        private void frmNotify_MouseDown(object sender, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left)
                DragForm();
        }
    }
}

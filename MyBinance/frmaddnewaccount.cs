using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Diagnostics;
using System.Drawing;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace MyBinance
{
    public partial class frmaddnewaccount : formBase
    {
        public frmaddnewaccount()
        {
            InitializeComponent();
        }

        public string APIKey { get; set; }
        public string SecretKey { get; set; }
        public string Comments { get; set; }
        private async void btnok_Click(object sender, EventArgs e)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(textBox3.Text))
                    throw new Exception("The Account Alias is required.");
                if (string.IsNullOrWhiteSpace(textBox1.Text))
                    throw new Exception("The Api Key is required.");
                if (string.IsNullOrWhiteSpace(textBox2.Text))
                    throw new Exception("The Secret Key is required.");

                APIKey = textBox1.Text;
                SecretKey = textBox2.Text;
                Comments = textBox3.Text;

                var b = new BinanceApiKey
                {
                    ApiKey = APIKey,
                    SecretKey = SecretKey,
                    Comment = Comments,

                };

                Cursor = Cursors.WaitCursor;
                btnok.Enabled = btncancel.Enabled = false;
                var acc=await b.Client.SpotApi.Account.GetAccountInfoAsync();
                if (acc == null || !acc.Success)
                    throw new Exception("API Keys are not working.");

                DialogResult = DialogResult.OK;
                Close();
            }
            catch (Exception er)
            {
                MessageBox.Show(er.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                textBox1.Focus();
                textBox1.SelectAll();
            }
            finally
            {
                btnok.Enabled = btncancel.Enabled = true;
                Cursor = Cursors.Default;
            }

        }

        private void frmaddnewaccount_Load(object sender, EventArgs e)
        {
            textBox3.Focus();
            textBox3.SelectAll();
            ctrHeader1.Image = Icon.ExtractAssociatedIcon(Assembly.GetExecutingAssembly().Location).ToBitmap();
        }

        private void linkLabel1_LinkClicked(object sender, LinkLabelLinkClickedEventArgs e)
        {
            OpenBrowser("https://www.binance.com/en/support/faq/360002502072");
        }
        public   void OpenBrowser(string url)
        {
            try
            {
                System.Diagnostics.Process.Start(url);
            }
            catch
            {
                // hack because of this: https://github.com/dotnet/corefx/issues/10361
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    url = url.Replace("&", "^&");
                    Process.Start(new ProcessStartInfo("cmd", $"/c start {url}") { CreateNoWindow = true });
                }
                else if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux))
                {
                    Process.Start("xdg-open", url);
                }
                else if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX))
                {
                    Process.Start("open", url);
                }
                else
                {
                    throw;
                }
            }
        }

    }
}

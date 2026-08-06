
namespace MyBinance
{
    partial class frmNotify
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            this.lblBTCPrice = new System.Windows.Forms.Label();
            this.SuspendLayout();
            // 
            // lblBTCPrice
            // 
            this.lblBTCPrice.BackColor = System.Drawing.Color.White;
            this.lblBTCPrice.Dock = System.Windows.Forms.DockStyle.Fill;
            this.lblBTCPrice.Font = new System.Drawing.Font("Segoe UI", 12F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point);
            this.lblBTCPrice.ForeColor = System.Drawing.Color.Green;
            this.lblBTCPrice.Location = new System.Drawing.Point(0, 0);
            this.lblBTCPrice.Name = "lblBTCPrice";
            this.lblBTCPrice.Size = new System.Drawing.Size(256, 51);
            this.lblBTCPrice.TabIndex = 2;
            this.lblBTCPrice.Text = "BTC Price $41,000.33\r\nBTC Price $41,000.33";
            this.lblBTCPrice.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
            this.lblBTCPrice.MouseDown += new System.Windows.Forms.MouseEventHandler(this.frmNotify_MouseDown);
            // 
            // frmNotify
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(7F, 15F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(256, 51);
            this.ControlBox = false;
            this.Controls.Add(this.lblBTCPrice);
            this.DoubleBuffered = true;
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.None;
            this.Name = "frmNotify";
            this.ShowIcon = false;
            this.ShowInTaskbar = false;
            this.StartPosition = System.Windows.Forms.FormStartPosition.WindowsDefaultLocation;
            this.Text = "Account Value";
            this.TopMost = true;
            this.MouseDown += new System.Windows.Forms.MouseEventHandler(this.frmNotify_MouseDown);
            this.ResumeLayout(false);

        }

        #endregion

        private System.Windows.Forms.Label lblBTCPrice;
    }
}
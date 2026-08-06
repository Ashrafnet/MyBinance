
namespace MyBinance
{
    partial class frmPlaceOrder
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
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(frmPlaceOrder));
            this.ctrHeader1 = new DataAccessLayerProvider.GUI.ctrHeader();
            this.SuspendLayout();
            // 
            // ctrHeader1
            // 
            this.ctrHeader1.BackColor = System.Drawing.SystemColors.Control;
            this.ctrHeader1.CausesValidation = false;
            this.ctrHeader1.Description = "Use this tool to place order/s on the exchange.";
            this.ctrHeader1.DescriptionColor = System.Drawing.Color.RoyalBlue;
            this.ctrHeader1.Dock = System.Windows.Forms.DockStyle.Top;
            this.ctrHeader1.Image = ((System.Drawing.Image)(resources.GetObject("ctrHeader1.Image")));
            this.ctrHeader1.ImagePosition = System.Windows.Forms.DockStyle.Left;
            this.ctrHeader1.Location = new System.Drawing.Point(0, 0);
            this.ctrHeader1.Name = "ctrHeader1";
            this.ctrHeader1.Size = new System.Drawing.Size(629, 54);
            this.ctrHeader1.TabIndex = 0;
            this.ctrHeader1.Title = "Place Order";
            this.ctrHeader1.TitleColor = System.Drawing.Color.Red;
            // 
            // frmPlaceOrder
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(7F, 15F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(629, 352);
            this.Controls.Add(this.ctrHeader1);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.Name = "frmPlaceOrder";
            this.ShowIcon = false;
            this.ShowInTaskbar = false;
            this.Text = "Place Order";
            this.ResumeLayout(false);

        }

        #endregion

        private DataAccessLayerProvider.GUI.ctrHeader ctrHeader1;
    }
}
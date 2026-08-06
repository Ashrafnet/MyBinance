
namespace MyBinance
{
    partial class frmOrderManager
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
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(frmOrderManager));
            this.ctrHeader1 = new DataAccessLayerProvider.GUI.ctrHeader();
            this.toolStrip1 = new System.Windows.Forms.ToolStrip();
            this.refreshtoolStripButton1 = new System.Windows.Forms.ToolStripButton();
            this.cancellorders = new System.Windows.Forms.ToolStripButton();
            this.toolStripSeparator1 = new System.Windows.Forms.ToolStripSeparator();
            this.exittoolStripButton2 = new System.Windows.Forms.ToolStripButton();
            this.statusStrip1 = new System.Windows.Forms.StatusStrip();
            this.lblstatus = new System.Windows.Forms.ToolStripStatusLabel();
            this.toolStrip1.SuspendLayout();
            this.statusStrip1.SuspendLayout();
            this.SuspendLayout();
            // 
            // ctrHeader1
            // 
            this.ctrHeader1.BackColor = System.Drawing.SystemColors.Control;
            this.ctrHeader1.CausesValidation = false;
            this.ctrHeader1.Description = "Description";
            this.ctrHeader1.DescriptionColor = System.Drawing.Color.RoyalBlue;
            this.ctrHeader1.Dock = System.Windows.Forms.DockStyle.Top;
            this.ctrHeader1.Image = ((System.Drawing.Image)(resources.GetObject("ctrHeader1.Image")));
            this.ctrHeader1.ImagePosition = System.Windows.Forms.DockStyle.Left;
            this.ctrHeader1.Location = new System.Drawing.Point(0, 0);
            this.ctrHeader1.Name = "ctrHeader1";
            this.ctrHeader1.Size = new System.Drawing.Size(800, 64);
            this.ctrHeader1.TabIndex = 0;
            this.ctrHeader1.Title = "Order Manger";
            this.ctrHeader1.TitleColor = System.Drawing.Color.Red;
            // 
            // toolStrip1
            // 
            this.toolStrip1.Items.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.refreshtoolStripButton1,
            this.cancellorders,
            this.toolStripSeparator1,
            this.exittoolStripButton2});
            this.toolStrip1.Location = new System.Drawing.Point(0, 64);
            this.toolStrip1.Name = "toolStrip1";
            this.toolStrip1.Size = new System.Drawing.Size(800, 39);
            this.toolStrip1.TabIndex = 5;
            this.toolStrip1.Text = "toolStrip1";
            // 
            // refreshtoolStripButton1
            // 
            this.refreshtoolStripButton1.Image = ((System.Drawing.Image)(resources.GetObject("refreshtoolStripButton1.Image")));
            this.refreshtoolStripButton1.ImageScaling = System.Windows.Forms.ToolStripItemImageScaling.None;
            this.refreshtoolStripButton1.ImageTransparentColor = System.Drawing.Color.Magenta;
            this.refreshtoolStripButton1.Name = "refreshtoolStripButton1";
            this.refreshtoolStripButton1.Size = new System.Drawing.Size(82, 36);
            this.refreshtoolStripButton1.Text = "Refresh";
            // 
            // cancellorders
            // 
            this.cancellorders.Image = ((System.Drawing.Image)(resources.GetObject("cancellorders.Image")));
            this.cancellorders.ImageScaling = System.Windows.Forms.ToolStripItemImageScaling.None;
            this.cancellorders.ImageTransparentColor = System.Drawing.Color.Magenta;
            this.cancellorders.Name = "cancellorders";
            this.cancellorders.Size = new System.Drawing.Size(164, 36);
            this.cancellorders.Text = "Cancel Selected Orders";
            // 
            // toolStripSeparator1
            // 
            this.toolStripSeparator1.Name = "toolStripSeparator1";
            this.toolStripSeparator1.Size = new System.Drawing.Size(6, 39);
            // 
            // exittoolStripButton2
            // 
            this.exittoolStripButton2.Image = ((System.Drawing.Image)(resources.GetObject("exittoolStripButton2.Image")));
            this.exittoolStripButton2.ImageScaling = System.Windows.Forms.ToolStripItemImageScaling.None;
            this.exittoolStripButton2.ImageTransparentColor = System.Drawing.Color.Magenta;
            this.exittoolStripButton2.Name = "exittoolStripButton2";
            this.exittoolStripButton2.Size = new System.Drawing.Size(72, 36);
            this.exittoolStripButton2.Text = "Close";
            // 
            // statusStrip1
            // 
            this.statusStrip1.Items.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.lblstatus});
            this.statusStrip1.Location = new System.Drawing.Point(0, 428);
            this.statusStrip1.Name = "statusStrip1";
            this.statusStrip1.RenderMode = System.Windows.Forms.ToolStripRenderMode.ManagerRenderMode;
            this.statusStrip1.Size = new System.Drawing.Size(800, 22);
            this.statusStrip1.TabIndex = 6;
            this.statusStrip1.Text = "statusStrip1";
            // 
            // lblstatus
            // 
            this.lblstatus.Name = "lblstatus";
            this.lblstatus.Size = new System.Drawing.Size(39, 17);
            this.lblstatus.Text = "Ready";
            // 
            // frmOrderManager
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(7F, 15F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(800, 450);
            this.Controls.Add(this.toolStrip1);
            this.Controls.Add(this.statusStrip1);
            this.Controls.Add(this.ctrHeader1);
            this.Name = "frmOrderManager";
            this.Text = "Order Manager";
            this.toolStrip1.ResumeLayout(false);
            this.toolStrip1.PerformLayout();
            this.statusStrip1.ResumeLayout(false);
            this.statusStrip1.PerformLayout();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private DataAccessLayerProvider.GUI.ctrHeader ctrHeader1;
        private System.Windows.Forms.ToolStrip toolStrip1;
        private System.Windows.Forms.ToolStripButton refreshtoolStripButton1;
        private System.Windows.Forms.ToolStripButton cancellorders;
        private System.Windows.Forms.ToolStripSeparator toolStripSeparator1;
        private System.Windows.Forms.ToolStripButton exittoolStripButton2;
        private System.Windows.Forms.StatusStrip statusStrip1;
        private System.Windows.Forms.ToolStripStatusLabel lblstatus;
    }
}
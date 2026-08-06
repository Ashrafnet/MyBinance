using System;
using System.Collections;
using System.ComponentModel;
using System.Drawing;
using System.Data;
using System.Windows.Forms;
using System.Drawing.Design;

namespace DataAccessLayerProvider.GUI
{
    // [Editor("System.Windows.Forms.Design.AnchorEditor, System.Design, Version=2.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a", typeof(UITypeEditor))]
    public class ctrHeader : UserControl
    {
        private System.Windows.Forms.Panel pnl3dDark;
        private System.Windows.Forms.Panel pnl3dBright;
        private Panel pnlDockPadding;
        private Label lblDescription;
        private Label lblTitle;
        private PictureBox picIcon;
        private bool _ShowLine = true;
        private Label label1;

        /// <summary>
        /// Gets or Sets if the line visable
        /// </summary>
        [DefaultValue(true)]
        public bool ShowLine
        {
            get { return _ShowLine; }
            set
            {
                _ShowLine = value;
                pnl3dBright.Visible = value;
            }
        }

        public DockStyle ImagePosition { get
            {
                return picIcon.Dock;
            }
            set
            {
                picIcon.Dock = value;
            }
        }
        /// <summary> 
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.Container components = null;

        /// <summary>
        /// Constructor for Header
        /// </summary>
        public ctrHeader()
        {
            // This call is required by the Windows.Forms Form Designer.
            InitializeComponent();
            Title = lblTitle.Text;
            Description = lblDescription.Text;
        }

        /// <summary> 
        /// Clean up any resources being used.
        /// </summary>
        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                if (components != null)
                {
                    components.Dispose();
                }
            }
            base.Dispose(disposing);
        }

        #region Component Designer generated code
        /// <summary> 
        /// Required method for Designer support - do not modify 
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(ctrHeader));
            this.pnl3dDark = new System.Windows.Forms.Panel();
            this.pnl3dBright = new System.Windows.Forms.Panel();
            this.pnlDockPadding = new System.Windows.Forms.Panel();
            this.lblDescription = new System.Windows.Forms.Label();
            this.lblTitle = new System.Windows.Forms.Label();
            this.label1 = new System.Windows.Forms.Label();
            this.picIcon = new System.Windows.Forms.PictureBox();
            this.pnlDockPadding.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.picIcon)).BeginInit();
            this.SuspendLayout();
            // 
            // pnl3dDark
            // 
            this.pnl3dDark.BackColor = System.Drawing.SystemColors.ControlDark;
            this.pnl3dDark.Dock = System.Windows.Forms.DockStyle.Bottom;
            this.pnl3dDark.Location = new System.Drawing.Point(0, 62);
            this.pnl3dDark.Name = "pnl3dDark";
            this.pnl3dDark.Size = new System.Drawing.Size(324, 1);
            this.pnl3dDark.TabIndex = 7;
            this.pnl3dDark.MouseDown += new System.Windows.Forms.MouseEventHandler(this.lblDescription_MouseDown);
            // 
            // pnl3dBright
            // 
            this.pnl3dBright.BackColor = System.Drawing.Color.White;
            this.pnl3dBright.Dock = System.Windows.Forms.DockStyle.Bottom;
            this.pnl3dBright.Location = new System.Drawing.Point(0, 63);
            this.pnl3dBright.Name = "pnl3dBright";
            this.pnl3dBright.Size = new System.Drawing.Size(324, 1);
            this.pnl3dBright.TabIndex = 8;
            this.pnl3dBright.MouseDown += new System.Windows.Forms.MouseEventHandler(this.lblDescription_MouseDown);
            // 
            // pnlDockPadding
            // 
            this.pnlDockPadding.BackColor = System.Drawing.SystemColors.Window;
            this.pnlDockPadding.Controls.Add(this.lblDescription);
            this.pnlDockPadding.Controls.Add(this.lblTitle);
            this.pnlDockPadding.Controls.Add(this.label1);
            this.pnlDockPadding.Controls.Add(this.picIcon);
            this.pnlDockPadding.Dock = System.Windows.Forms.DockStyle.Fill;
            this.pnlDockPadding.Font = new System.Drawing.Font("Tahoma", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point);
            this.pnlDockPadding.Location = new System.Drawing.Point(0, 0);
            this.pnlDockPadding.Name = "pnlDockPadding";
            this.pnlDockPadding.Padding = new System.Windows.Forms.Padding(8, 6, 4, 4);
            this.pnlDockPadding.RightToLeft = System.Windows.Forms.RightToLeft.No;
            this.pnlDockPadding.Size = new System.Drawing.Size(324, 64);
            this.pnlDockPadding.TabIndex = 6;
            this.pnlDockPadding.RightToLeftChanged += new System.EventHandler(this.pnlDockPadding_RightToLeftChanged);
            this.pnlDockPadding.MouseDown += new System.Windows.Forms.MouseEventHandler(this.lblDescription_MouseDown);
            // 
            // lblDescription
            // 
            this.lblDescription.Dock = System.Windows.Forms.DockStyle.Fill;
            this.lblDescription.FlatStyle = System.Windows.Forms.FlatStyle.System;
            this.lblDescription.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point);
            this.lblDescription.ForeColor = System.Drawing.Color.RoyalBlue;
            this.lblDescription.Location = new System.Drawing.Point(61, 33);
            this.lblDescription.Name = "lblDescription";
            this.lblDescription.Size = new System.Drawing.Size(259, 27);
            this.lblDescription.TabIndex = 5;
            this.lblDescription.Text = "Description";
            this.lblDescription.DoubleClick += new System.EventHandler(this.lblTitle_DoubleClick);
            this.lblDescription.MouseDown += new System.Windows.Forms.MouseEventHandler(this.lblDescription_MouseDown);
            // 
            // lblTitle
            // 
            this.lblTitle.Dock = System.Windows.Forms.DockStyle.Top;
            this.lblTitle.FlatStyle = System.Windows.Forms.FlatStyle.System;
            this.lblTitle.Font = new System.Drawing.Font("Tahoma", 10F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point);
            this.lblTitle.ForeColor = System.Drawing.Color.DarkRed;
            this.lblTitle.Location = new System.Drawing.Point(61, 14);
            this.lblTitle.Name = "lblTitle";
            this.lblTitle.Size = new System.Drawing.Size(259, 19);
            this.lblTitle.TabIndex = 4;
            this.lblTitle.Text = "Title";
            this.lblTitle.TextAlign = System.Drawing.ContentAlignment.MiddleLeft;
            this.lblTitle.DoubleClick += new System.EventHandler(this.lblTitle_DoubleClick);
            this.lblTitle.MouseDown += new System.Windows.Forms.MouseEventHandler(this.lblDescription_MouseDown);
            // 
            // label1
            // 
            this.label1.Dock = System.Windows.Forms.DockStyle.Top;
            this.label1.FlatStyle = System.Windows.Forms.FlatStyle.System;
            this.label1.Font = new System.Drawing.Font("Tahoma", 10F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point);
            this.label1.ForeColor = System.Drawing.Color.Red;
            this.label1.Location = new System.Drawing.Point(61, 6);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(259, 8);
            this.label1.TabIndex = 6;
            this.label1.TextAlign = System.Drawing.ContentAlignment.MiddleLeft;
            this.label1.DoubleClick += new System.EventHandler(this.lblTitle_DoubleClick);
            this.label1.MouseDown += new System.Windows.Forms.MouseEventHandler(this.lblDescription_MouseDown);
            // 
            // picIcon
            // 
            this.picIcon.Dock = System.Windows.Forms.DockStyle.Left;
            this.picIcon.Image = ((System.Drawing.Image)(resources.GetObject("picIcon.Image")));
            this.picIcon.Location = new System.Drawing.Point(8, 6);
            this.picIcon.Name = "picIcon";
            this.picIcon.Padding = new System.Windows.Forms.Padding(5, 0, 0, 0);
            this.picIcon.Size = new System.Drawing.Size(53, 54);
            this.picIcon.SizeMode = System.Windows.Forms.PictureBoxSizeMode.AutoSize;
            this.picIcon.TabIndex = 3;
            this.picIcon.TabStop = false;
            this.picIcon.DoubleClick += new System.EventHandler(this.lblTitle_DoubleClick);
            this.picIcon.MouseDown += new System.Windows.Forms.MouseEventHandler(this.lblDescription_MouseDown);
            // 
            // ctrHeader
            // 
            this.BackColor = System.Drawing.SystemColors.Control;
            this.CausesValidation = false;
            this.Controls.Add(this.pnl3dDark);
            this.Controls.Add(this.pnl3dBright);
            this.Controls.Add(this.pnlDockPadding);
            this.Name = "ctrHeader";
            this.Size = new System.Drawing.Size(324, 64);
            this.SizeChanged += new System.EventHandler(this.Header_SizeChanged);
            this.DoubleClick += new System.EventHandler(this.lblTitle_DoubleClick);
            this.MouseDown += new System.Windows.Forms.MouseEventHandler(this.lblDescription_MouseDown);
            this.pnlDockPadding.ResumeLayout(false);
            this.pnlDockPadding.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.picIcon)).EndInit();
            this.ResumeLayout(false);

        }
        #endregion

        private void ResizeImageAndText()
        {
            //Resize image 
            if (picIcon.Image != null)
                picIcon.Size = picIcon.Image.Size;
            //Relocate image according to its size
            picIcon.Top = (this.Height - picIcon.Height) / 2;
            picIcon.Left = this.Width - picIcon.Width - 8;
            //Fit text around picture
            lblTitle.Width = picIcon.Left - lblTitle.Left;
            lblDescription.Width = picIcon.Left - lblDescription.Left;
        }

        private void Header_SizeChanged(object sender, System.EventArgs e)
        {
            ResizeImageAndText();
        }
        private string _Title;
        /// <summary>
        /// Get/Set the title for the wizard page
        /// </summary>
        [Category("Appearance")]
        public string Title
        {
            get
            {
                return _Title;
            }
            set
            {
                _Title = value;
                lblTitle.Text = "  " + value;
            }
        }

        /// <summary>
        /// Get/Set the title ForeColor for the wizard page
        /// </summary>
        [Category("Appearance")]
        public Color TitleColor
        {
            get
            {
                return lblTitle.ForeColor;
            }
            set
            {
                lblTitle.ForeColor = value;
            }
        }
        private string _Description;
        /// <summary>
        /// Gets/Sets the
        /// </summary>
        [Category("Appearance")]
        [System.ComponentModel.Editor("System.ComponentModel.Design.MultilineStringEditor, System.Design, Version=2.0.0.0, Culture=neutral, PublicKeyToken=b03f5f7f11d50a3a", typeof(System.Drawing.Design.UITypeEditor))]
        public string Description
        {
            get
            {
                return _Description;
            }
            set
            {
                _Description = value;
                lblDescription.Text = "    " + value;
            }
        }

        /// <summary>
        /// Get/Set the Description ForeColor for the wizard page
        /// </summary>
        [Category("Appearance")]
        public Color DescriptionColor
        {
            get
            {
                return lblDescription.ForeColor;
            }
            set
            {
                lblDescription.ForeColor = value;
            }
        }

        /// <summary>
        /// Gets/Sets the Icon
        /// </summary>
        [Category("Appearance")]
        public Image Image
        {
            get
            {
                return picIcon.Image;
            }
            set
            {
                picIcon.Image = value;
                ResizeImageAndText();
            }
        }
        private void pnlDockPadding_RightToLeftChanged(object sender, EventArgs e)
        {
            if (RightToLeft == RightToLeft.Yes) picIcon.Dock = DockStyle.Right;
            else if (RightToLeft == RightToLeft.No) picIcon.Dock = DockStyle.Left;
        }

        private void lblDescription_MouseDown(object sender, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left)
            {
                ReleaseCapture();
                SendMessage(Parent.Handle, WM_NCLBUTTONDOWN, HT_CAPTION, 0);
                if (e.Clicks > 1)
                    lblTitle_DoubleClick(sender, e);
            }
        }
        public const int WM_NCLBUTTONDOWN = 0xA1;
        public const int HT_CAPTION = 0x2;

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern int SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool ReleaseCapture();

        private void lblTitle_DoubleClick(object sender, EventArgs e)
        {
            var form = ParentForm;
            if (form != null)
            {
                if (form.MaximizeBox == false || form.ControlBox==false ) return;
                if (form.WindowState == FormWindowState.Normal)
                    form.WindowState = FormWindowState.Maximized;
                else if (form.WindowState == FormWindowState.Maximized)
                    form.WindowState = FormWindowState.Normal;
            }
        }
    }
}

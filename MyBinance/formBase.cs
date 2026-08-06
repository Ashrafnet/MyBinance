using DataAccessLayerProvider.GUI;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace MyBinance
{
    public partial class formBase : Form
    {
        public formBase()
        {
            InitializeComponent();
            Icon = Icon.ExtractAssociatedIcon(Assembly.GetExecutingAssembly().Location);

        }

        private void formBase_MouseDown(object sender, MouseEventArgs e)
        {

            if (e.Button == MouseButtons.Left)
            {
                ctrHeader.ReleaseCapture();
                ctrHeader.SendMessage(Handle, ctrHeader.WM_NCLBUTTONDOWN, ctrHeader.HT_CAPTION, 0);
            }
        }

       public void DragForm()
        {
            ctrHeader.ReleaseCapture();
            ctrHeader.SendMessage(this.Handle, ctrHeader.WM_NCLBUTTONDOWN, ctrHeader.HT_CAPTION, 0);


        }

        private void formBase_Load(object sender, EventArgs e)
        {
            
            var cs=Controls;
  
            foreach (var c in cs)
            {
                if(c.GetType()==typeof(Label))
                {
                    ((Label)c).MouseDown += (s, ss) =>
                    {
                        formBase_MouseDown(s, ss);
                    };
                }
                if (c.GetType() == typeof(PictureBox))
                {
                    ((PictureBox)c).MouseDown += (s, ss) =>
                    {
                        formBase_MouseDown(s, ss);
                    };
                }


            }
        }
    }
}

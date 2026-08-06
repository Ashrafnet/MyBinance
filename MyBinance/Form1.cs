using Binance.Net.Clients;
using Binance.Net.Interfaces;
using Binance.Net.Objects;
using Binance.Net.Objects.Models.Spot;
using Binance.Net.Objects.Models.Spot.Socket;
using CryptoExchange.Net.Authentication;
using MyBinance.GUI;
using System;
using System.Collections.Generic;
using System.Data;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using System.Threading.Tasks;
using System.Timers;
using System.Windows.Forms;

namespace MyBinance
{
    public partial class Form1 : formBase
    {
        public Form1()
        {
            InitializeComponent();
            listView1.DoubleBufferList();
            listView2.DoubleBufferList();
            listView_openOrders.DoubleBufferList();

            listView_accounthistory.DoubleBufferList();
            listView_accounthistory_details.DoubleBufferList();



            LoadIcons();
        }

        void LoadIcons()
        {
            var images = typeof(Properties.Resources)
               .GetProperties(BindingFlags.Static | BindingFlags.NonPublic |
                                                    BindingFlags.Public)
               .Where(p => p.PropertyType == typeof(Bitmap))
               .Select(x => new { Name = x.Name, Image = x.GetValue(null, null) })
               .ToList();

            // var rsrcSet = Properties.Resources.ResourceManager.GetResourceSet(CultureInfo.CurrentCulture, false, true);

            foreach (var entry in images)
            {

                var name = entry.Name + "";
                var resource = entry.Image as Image;
                if (name.StartsWith("_"))
                    name = name.Substring(1);
                imageList1.Images.Add(name, resource);
            }

        }

        long _cnt = 0;

        List<BinanceApiKey> binanceApiKeys = new List<BinanceApiKey>();
        Dictionary<string, IBinanceMiniTick> SymbolPrices = new Dictionary<string, IBinanceMiniTick>();

        public event Action<IEnumerable<IBinanceMiniTick>, decimal, decimal> OnNewPriceAction;
        frmNotify frmNotify = null;
        private async void Form1_Load(object sender, EventArgs e)
        {
            
            var xx = new BinanceClientOptions();
            xx.ReceiveWindow = TimeSpan.FromMinutes(-5);
            Binance.Net.Clients. BinanceClient.SetDefaultOptions(xx);
            lvwColumnSorter = new ListViewColumnSorter();
            lvwColumnSorter2 = new ListViewColumnSorter();
            listView1.ListViewItemSorter = lvwColumnSorter;
            listView2.ListViewItemSorter = lvwColumnSorter2;
            listView_accounthistory_details.ListViewItemSorter = lvwColumnSorter2;

            lvwColumnSorter2.SortColumn = 5;
            lvwColumnSorter2.Order = SortOrder.Descending;
            // Perform the sort with these new sort options.
            this.listView2.Sort();
            this.listView_accounthistory_details.Sort();
            dateTimePicker1.Value = DateTime.Now.AddDays(-10);
            dateTimePicker2.Value = DateTime.Now;

            LoadAccountsJson();

            var socketClient = new BinanceSocketClient();
            await RefreshAllPricesAsync();

            _ =await  socketClient.SpotStreams.SubscribeToAllMiniTickerUpdatesAsync(symboles =>
            {
                _cnt++;
                if (symboles != null && symboles.Data.Count() > 0)
                {

                    foreach (var item in symboles.Data)
                        SymbolPrices[item.Symbol] = item;

                    OnNewPriceAction?.Invoke(symboles.Data, btcprice.USDT, AccountsValue);

                    RefreshPricesUI();
                }

            });

            await LoadAccountsAsync();



        }

        private async Task RefreshAllPricesAsync()
        {
            if (binanceApiKeys?.Count < 1) return;
            var prices = await binanceApiKeys[0].Client.SpotApi.ExchangeData.GetPricesAsync();
            foreach (var item in prices.Data)
                SymbolPrices[item.Symbol] = new  BinanceMiniTick { LastPrice = item.Price, TimeStamp = item.Timestamp };
        }

        private void RefreshPricesUI()
        {
            if (InvokeRequired)
            {
                Invoke(new Action(RefreshPricesUI));
                return;
            }
            try
            {
                var _green = Color.DarkGreen;
                var _red = Color.Red;
                var _black = Color.Black;

                decimal total_account_usdt = 0;
                if (listView2.Items.Count > 0 && listView1.Items.Count > 0)
                {
                    foreach (ListViewItem item in listView1.Items)
                    {

                        var client_balances = ((BinanceClient, IEnumerable<BinanceBalance>))item.Tag;

                        var balance = CalcBalances(client_balances.Item2);

                        item.UseItemStyleForSubItems = false;
                        if (item.SubItems[1].Text.ToDecimalOrZero() > balance.USDT)
                            item.SubItems[1].ForeColor = _red;
                        else if (item.SubItems[1].Text.ToDecimalOrZero() < balance.USDT)
                            item.SubItems[1].ForeColor = _green;
                        else
                            item.SubItems[1].ForeColor = _black;

                        if (item.SubItems[2].Text.ToDecimalOrZero() > balance.BTC)
                            item.SubItems[2].ForeColor = _red;
                        else if (item.SubItems[2].Text.ToDecimalOrZero() < balance.BTC)
                            item.SubItems[2].ForeColor = _green;
                        else
                            item.SubItems[1].ForeColor = _black;

                        item.SubItems[1].Text = balance.USDT.ToString("C");
                        item.SubItems[2].Text = balance.BTC.ToBTCValue();

                        total_account_usdt += balance.USDT;
                    }

                    foreach (ListViewItem item in listView2.Items)
                    {
                        var symbol = item.Text;
                        var price = GetSymbolPrice(symbol);
                        var _usdt = price.USDT * decimal.Parse(item.SubItems[1].Text);
                        var _btc = price.BTC * decimal.Parse(item.SubItems[1].Text);
                        //if (!showsmallamounts && _usdt < 3)
                        //    item.Remove();

                        item.UseItemStyleForSubItems = false;
                        if (item.SubItems[6].Text.ToDecimalOrZero() > price.USDT)
                            item.SubItems[6].ForeColor = _red;
                        else if (item.SubItems[4].Text.ToDecimalOrZero() < price.USDT)
                            item.SubItems[6].ForeColor = _green;
                        else
                            item.SubItems[6].ForeColor = _black;


                        item.SubItems[4].Text = (_usdt).ToString("C") + "";
                        item.SubItems[5].Text = (_btc).ToBTCValue() + "";

                        item.SubItems[6].Text = price.USDT.ToUSDTValue();
                        item.SubItems[7].Text = price.BTC.ToBTCValue();
                        //  btc += _btc;
                        // usdt += _usdt;
                    }

                    foreach (ListViewItem item in listView_openOrders.Items)
                    {
                        var order = item.Tag as BinanceOrder;
                        if (order == null) continue;

                        var symbol = order.Symbol;
                        var price = GetSymbolPrice(symbol.Replace("USDT", ""));

                        item.SubItems[4].Text = price.USDT.ToUSDTValue();
                    }

                    
                    foreach (ListViewItem item in listView_accounthistory_details.Items)
                    {
                        if (item == null) continue;
                        var order = item.Tag as BinanceBalance;
                        if (order == null) continue;
                         
                        var symbol = order.Asset ;
                        var price = GetSymbolPrice(symbol);
                        var total = price.USDT * order.Total;

                        item.SubItems[7].Text = price.USDT.ToUSDTValue();
                        item.SubItems[5].Text = total.ToUSDTValue();
                    }
                    foreach (ListViewItem item in listView_accounthistory.Items)
                    {
                        if (item == null) continue;
                        var balancess = item.Tag as BinanceSpotAccountSnapshot;
                        if (balancess == null) continue;

                        var bal = CalcBalances(balancess.Data?.Balances);
                        item.SubItems[2].Text = bal.USDT.ToGroupedThounsands() + "";

                    }
                    


                }
                btcprice = GetSymbolPrice("BTCUSDT");
                AccountsValue = total_account_usdt;
                lblBTCPrice.Text = "BTC Price " + btcprice.USDT.ToString("C");
                lblBTCPrice.Text += $"{Environment.NewLine }Accounts {total_account_usdt:C}";
                lblBTCPrice.Visible = btcprice.USDT > 0;
            }
            catch
            {


            }
            finally
            {
                updatetimetoolStripStatusLabel1.Text = "Update Time: " + DateTime.Now.ToString("F");
            }
        }
        (decimal USDT, decimal BTC) btcprice = (0, 0);
        decimal AccountsValue = 0;
        int i = 0;
        void LoadAccountsJson()
        {
            try
            {
                if (binanceApiKeys != null && binanceApiKeys.Count > 0)
                {
                    binanceApiKeys.ForEach(s =>
                    {
                        if (s.UserStreamRegistered)
                        {
                            s.UserUpdates -= Item_UserUpdates;
                            s.UserStreamRegistered = false;
                        }
                    });
                }
                var json = File.ReadAllText("_accounts.json");
                binanceApiKeys = JsonSerializer.Deserialize<List<BinanceApiKey>>(json);
                if (binanceApiKeys == null)
                    binanceApiKeys = new List<BinanceApiKey>();
            }
            catch
            {
                if (binanceApiKeys == null)
                    binanceApiKeys = new List<BinanceApiKey>();
            }

            binanceApiKeys?.ForEach(s => s.UserStreamRegistered = false);
            try
            {
                var json = File.ReadAllText("_accounts_data.json");
                SymbolPrices_Dates = JsonSerializer.Deserialize<Dictionary<string, List<SymbolPriceDate>>>(json);
                if (SymbolPrices_Dates == null)
                    SymbolPrices_Dates = new();
            }
            catch
            {
                if (SymbolPrices_Dates == null)
                    SymbolPrices_Dates = new();

            }

        }

        async Task LoadAccountsAsync()
        {
            try
            {
                this.UseWaitCursor = true;
                lblstatus.Text = "Loading Acounts...";
                listView1.BeginUpdate();
                listView1.Items.Clear();
                foreach (var item in binanceApiKeys)
                {
                    if (!item.UserStreamRegistered)
                    {
                        item.UserUpdates += Item_UserUpdates;
                        item.StartStreamAsync();
                        item.UserStreamRegistered = true;
                    }
                    var lvi = new ListViewItem(item.Comment);
                    var info = await item.Client.SpotApi.Account.GetAccountInfoAsync();
                    if (info.Success)
                    {
                        var Balances = CalcBalances(info.Data.Balances);
                        lvi.SubItems.Add(Balances.USDT.ToString("C"));
                        lvi.SubItems.Add(Balances.BTC.ToBTCValue());
                    }
                    else
                        throw new Exception(info.Error.Message);
                    lvi.Tag = (item.Client, info.Data.Balances);
                    listView1.Items.Add(lvi);
                    lvi.ImageIndex = 0;
                }
                if (listView1.Items.Count > 0 && listView1.Items.Count > _selected_index)
                    listView1.Items[_selected_index].Selected = true;
                else if (listView1.Items.Count > 0)
                    listView1.Items[0].Selected = true;

                lblstatus.Text = "Ready.";
            }
            catch (Exception er)
            {
                lblstatus.Text = er.Message;
            }
            finally
            {
                listView1.EndUpdate();
                this.UseWaitCursor = false;
            }

        }

        private void Item_UserUpdates(string Client_Alias, BinanceStreamOrderUpdate streamOrderUpdate, BinanceStreamPositionsUpdate streamPositionsUpdate)
        {

            UpdateListviewOrder(  Client_Alias,   streamOrderUpdate,   streamPositionsUpdate);

        }
        System.Media.SoundPlayer player = new System.Media.SoundPlayer(Properties.Resources.orderupdate);
        async void UpdateListviewOrder(string Client_Alias, BinanceStreamOrderUpdate streamOrderUpdate, BinanceStreamPositionsUpdate streamPositionsUpdate)
        {
            if (InvokeRequired)
            {
                Invoke(new Action<string, BinanceStreamOrderUpdate, BinanceStreamPositionsUpdate>(UpdateListviewOrder), new object[] { Client_Alias, streamOrderUpdate, streamPositionsUpdate });
                return;
            }
            if (streamOrderUpdate != null)
            {
                if (_enablesounds)
                    player.Play();
                await LoadAccountsAsync();

                var filled = ((streamOrderUpdate.QuantityFilled / streamOrderUpdate.Quantity) * 100) .ToPercentage();
                var i = listView_openOrders.Items.IndexOfKey(streamOrderUpdate.ClientOrderId + "");
                if (i >= 0)                
                    listView_openOrders.Items[i].SubItems[6].Text = filled;
                
                if(streamOrderUpdate.Status== Binance.Net.Enums.OrderStatus.New)
                    lblstatus2.Text = $"New Order: Client={Client_Alias }, Pair={streamOrderUpdate.Symbol}, Price={streamOrderUpdate.Price}";
                else if (streamOrderUpdate.Status == Binance.Net.Enums.OrderStatus.Filled || streamOrderUpdate.Status == Binance.Net.Enums.OrderStatus.PartiallyFilled)
                    lblstatus2.Text = $"Order Updated: Client={Client_Alias }, Pair={streamOrderUpdate.Symbol}, Filled={filled}";
                else
                    lblstatus2.Text = $"Order {streamOrderUpdate.Status}: Client={Client_Alias }, Pair={streamOrderUpdate.Symbol}, Event={streamOrderUpdate.Event}: {streamOrderUpdate.EventTime }";
            }
            if (streamPositionsUpdate != null)
            {
                //  lblstatus.Text = $"New Order: Client={Client_Alias }, Pair={streamPositionsUpdate.Balances}, Filled={filled}";

            }
        }

        Dictionary<string, List<SymbolPriceDate>> SymbolPrices_Dates = new();
        async Task<decimal> GetSymbolPriceDateAsync(string symbol, DateTime date)
        {
            if (SymbolPrices_Dates != null && SymbolPrices_Dates.Count > 0 && SymbolPrices_Dates.ContainsKey(symbol))
            {
                if (SymbolPrices_Dates[symbol] != null && SymbolPrices_Dates[symbol].Count > 0 && !SymbolPrices_Dates[symbol][0].IsValidSymbol) return 0;
                var c = SymbolPrices_Dates[symbol]?.FirstOrDefault(s => s.Date_Close.Date == date.Date);
                if (c != null)
                    return c.Price_Close;
            }

            if (binanceApiKeys == null || binanceApiKeys.Count < 1 || binanceApiKeys[0] == null || binanceApiKeys[0].Client == null) return 0;
            if (symbol == "USDTUSDT" || symbol == "BTCBTC")
                return 1;

            var d = await binanceApiKeys[0].Client.SpotApi.ExchangeData.GetKlinesAsync(symbol, Binance.Net.Enums.KlineInterval.OneDay, date);
            if (!d.Success)
            {
                if (d.Error.Code == -1121) //invalid symbol
                {
                    SymbolPrices_Dates[symbol] = new List<SymbolPriceDate>();
                    SymbolPrices_Dates[symbol].Add(new SymbolPriceDate { Date_Close = date, Symbol = symbol, Price_Close = 0, IsValidSymbol = false });
                }
                else
                    SymbolPrices_Dates[symbol] = null;
                return 0;
            }
            var price_close = d.Data.FirstOrDefault()?.ClosePrice ?? 0;
            if (!SymbolPrices_Dates.ContainsKey(symbol))
                SymbolPrices_Dates.Add(symbol, new List<SymbolPriceDate>());
            SymbolPrices_Dates[symbol].Add(new SymbolPriceDate { Date_Close = date, Symbol = symbol, Price_Close = price_close });
            return price_close;
        }

        (decimal USDT, decimal BTC) GetSymbolPrice(string symbol)
        {
            if (string.IsNullOrWhiteSpace(symbol)) return (0, 0);
            if (SymbolPrices == null || SymbolPrices.Count < 1) return (0, 0);
            decimal? LastPrice_usdt = 0;
            decimal? LastPrice_btc = 0;

            if (symbol == "USDT")
            {
                symbol = "BTC" + symbol;
                if (SymbolPrices.ContainsKey(symbol))
                    LastPrice_btc = 1 / SymbolPrices[symbol]?.LastPrice;
                LastPrice_usdt = 1;
            }
            else if (symbol == "BTC")
            {
                symbol = symbol + "USDT";
                if (SymbolPrices.ContainsKey(symbol))
                    LastPrice_usdt = SymbolPrices[symbol]?.LastPrice;
                LastPrice_btc = 1;
            }
            else
            {
                var _symbol = symbol + "USDT";
                if (SymbolPrices.ContainsKey(_symbol))
                    LastPrice_usdt = SymbolPrices[_symbol]?.LastPrice;

                _symbol = symbol + "BTC";
                if (SymbolPrices.ContainsKey(_symbol))
                    LastPrice_btc = SymbolPrices[_symbol]?.LastPrice;

                if (symbol == "BTCUSDT")
                {
                    if (SymbolPrices.ContainsKey(symbol))
                        LastPrice_usdt = SymbolPrices[symbol]?.LastPrice;
                }
            }

            return (LastPrice_usdt ?? 0, LastPrice_btc ?? 0);
        }

        (decimal USDT, decimal BTC) CalcBalances(IEnumerable<BinanceBalance> balances)
        {
            decimal USDT = 0; decimal BTC = 0;
            if (balances != null)
                foreach (var item in balances)
                {
                    if (item.Total <= 0) continue;
                    decimal? LastPrice_usdt = 0;
                    decimal? LastPrice_btc = 0;

                    (LastPrice_usdt, LastPrice_btc) = GetSymbolPrice(item.Asset);

                    LastPrice_usdt = LastPrice_usdt * item.Total;
                    LastPrice_btc = LastPrice_btc * item.Total;

                    USDT += LastPrice_usdt ?? 0;
                    BTC += LastPrice_btc ?? 0;
                }
            return (USDT, BTC);
        }

        async Task<decimal> CalcBalancesAsync(IEnumerable<BinanceBalance> balances, DateTime date)
        {
            decimal USDT = 0;
            foreach (var item in balances)
            {
                if (item.Total <= 0) continue;
                decimal? LastPrice_usdt = 0;

                LastPrice_usdt = await GetSymbolPriceDateAsync(item.Asset + "USDT", date);

                LastPrice_usdt = LastPrice_usdt * item.Total;


                USDT += LastPrice_usdt ?? 0;

            }
            return USDT;
        }

        decimal _small_usdt_amount = 3;

        async Task LoadAccountHistoryDetailsAsync(BinanceSpotAccountSnapshot snapshot)
        {
            try
            {
                Cursor = Cursors.WaitCursor;
                string _quicksearch = quicksearchtoolStripTextBox1.Text;
                listView_accounthistory_details.Items.Clear();
                if (snapshot != null && snapshot.Data != null)
                {
                    listView_accounthistory_details.BeginUpdate();

                    foreach (var item in snapshot.Data.Balances)
                    {
                        if (item.Total <= 0) continue;
                        if (!string.IsNullOrWhiteSpace(_quicksearch) && !item.Asset.ToLower().Trim().Contains(_quicksearch)) continue;
                        var lvi = new ListViewItem(item.Asset);
                        var keyimage = item.Asset.Trim().ToLower();
                        if (imageList1.Images.ContainsKey(keyimage))
                            lvi.ImageKey = keyimage;
                        else
                            lvi.ImageIndex = 1;
                        lvi.SubItems.Add(item.Total.ToGroupedThounsands() + "");
                        lvi.SubItems.Add(item.Available.ToGroupedThounsands() + "");
                        lvi.SubItems.Add(item.Locked.ToGroupedThounsands() + "");

                        decimal? LastPrice_usdt = 0;
                        decimal? LastPrice_btc = 0;

                        (LastPrice_usdt, LastPrice_btc) = GetSymbolPrice(item.Asset);
                        var LastPrice_usdt_date = await GetSymbolPriceDateAsync(item.Asset + "USDT", snapshot.Timestamp);

                        var LastPrice_usdt_total = LastPrice_usdt * item.Total;
                        var LastPrice_usdt_date_total = LastPrice_usdt_date * item.Total;
                        if (!showsmallamounts && LastPrice_usdt_total < _small_usdt_amount) continue;

                        lvi.SubItems.Add(LastPrice_usdt_date_total.ToUSDTValue());
                        lvi.SubItems.Add(LastPrice_usdt_total.GetValueOrDefault().ToUSDTValue());

                        lvi.SubItems.Add(LastPrice_usdt_date.ToUSDTValue());
                        lvi.SubItems.Add(LastPrice_usdt.GetValueOrDefault().ToUSDTValue());

                        lvi.Tag = item;
                        listView_accounthistory_details.Items.Add(lvi);


                    }

                }
            }
            catch (Exception ex)
            {

                MessageBox.Show(ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                Cursor = Cursors.Default;
                listView_accounthistory_details.EndUpdate();
            }

        }

        async Task LoadAccountInfoAsync(BinanceClient client, bool OnlyHistory = false)
        {
            decimal _Totalfree = 0;
            decimal _TotalBuy = 0;
            decimal _TotalSell = 0;
            string _quicksearch = quicksearchtoolStripTextBox1.Text;
            try
            {
                lblstatus.Text = "Loading Account Balances..";
                Cursor = Cursors.WaitCursor;

                if (OnlyHistory)
                    goto History;

                var info = await client.SpotApi.Account.GetAccountInfoAsync();
                if (info.Success)
                {
                    listView2.BeginUpdate();
                    listView2.Items.Clear();
                    listView2.Tag = info.Data.Balances;
                    foreach (var item in info.Data.Balances)
                    {
                        if (item.Total <= 0) continue;
                        if (!string.IsNullOrWhiteSpace(_quicksearch) && !item.Asset.ToLower().Trim().Contains(_quicksearch)) continue;
                        var lvi = new ListViewItem(item.Asset);
                        var keyimage = item.Asset.Trim().ToLower();
                        if (imageList1.Images.ContainsKey(keyimage))
                            lvi.ImageKey = keyimage;
                        else
                            lvi.ImageIndex = 1;
                        lvi.SubItems.Add(item.Total.ToGroupedThounsands() + "");
                        lvi.SubItems.Add(item.Available .ToGroupedThounsands() + "");
                        lvi.SubItems.Add(item.Locked.ToGroupedThounsands() + "");

                        decimal? LastPrice_usdt = 0;
                        decimal? LastPrice_btc = 0;

                        (LastPrice_usdt, LastPrice_btc) = GetSymbolPrice(item.Asset);

                        _Totalfree += (LastPrice_usdt * item.Available ).GetValueOrDefault();
                        LastPrice_usdt = LastPrice_usdt * item.Total;
                        LastPrice_btc = LastPrice_btc * item.Total;


                        if (!showsmallamounts && LastPrice_usdt < _small_usdt_amount) continue;
                        lvi.SubItems.Add(LastPrice_usdt.GetValueOrDefault().ToUSDTValue());
                        lvi.SubItems.Add(LastPrice_btc.GetValueOrDefault().ToBTCValue());
                        lvi.SubItems.Add("");//usdt price
                        lvi.SubItems.Add("");//btc price

                        //lvi.ImageIndex = 1;
                        lvi.Tag = item;
                        listView2.Items.Add(lvi);



                    }
                    listView2.EndUpdate();
                }

                var info1 = await client.SpotApi.Trading.GetOpenOrdersAsync();
                if (info1.Success)
                {
                    listView_openOrders.BeginUpdate();
                    listView_openOrders.Items.Clear();
                    //listView_openOrders.Tag = info1.Data;
                    foreach (var item in info1.Data.OrderByDescending(s => s.CreateTime))
                    {
                        if (!string.IsNullOrWhiteSpace(_quicksearch) && !item.Symbol.ToLower().Trim().Contains(_quicksearch)) continue;

                        var lvi = new ListViewItem(item.UpdateTime.GetValueOrDefault().ToLocalTime() + "");
                        if (item.Side == Binance.Net.Enums.OrderSide.Buy)
                        {
                            lvi.Group = listView_openOrders.Groups[0];
                            lvi.ForeColor = Color.DarkGreen;
                            lvi.ImageIndex = 0;
                            _TotalBuy += item.Price * item.Quantity;
                        }
                        else
                        {
                            lvi.Group = listView_openOrders.Groups[1];
                            lvi.ForeColor = Color.DarkRed;
                            lvi.ImageIndex = 1;
                            if(item.Type == Binance.Net.Enums.SpotOrderType.Limit || item.Type == Binance.Net.Enums.SpotOrderType.LimitMaker)
                            _TotalSell += item.Price * item.Quantity;
                        }

                        lvi.SubItems.Add(item.Symbol + "");
                        lvi.SubItems.Add(item.Type + "");
                        lvi.SubItems.Add(item.Price.ToUSDTValue() + "");
                        lvi.SubItems.Add("");
                        lvi.SubItems.Add(item.Quantity.ToGroupedThounsands() + "");
                        lvi.SubItems.Add(item.QuantityFilled.ToPercentage() + "");
                        lvi.SubItems.Add((item.Price * item.Quantity).ToUSDTValue());




                        //lvi.ImageIndex = 1;
                        lvi.Tag = item;
                        lvi.Name = item.ClientOrderId + "";
                        listView_openOrders.Items.Add(lvi);


                    }
                    listView_openOrders.EndUpdate();
                }

            History:
                var date1 = dateTimePicker1.Value;
                var date2 = dateTimePicker2.Value;
                var info_history = await client.SpotApi.Account.GetDailySpotAccountSnapshotAsync(startTime: date1, endTime: date2);
                if (info_history.Success)
                {
                    listView_accounthistory.Items.Clear();
                    foreach (var item in info_history.Data.OrderByDescending(s => s.Timestamp))
                    {
                        var lvi = new ListViewItem(item.Timestamp.ToShortDateString() + "");
                        lvi.ImageIndex = 1;
                        lvi.Tag = item;
                        var bal = CalcBalances(item.Data.Balances);
                        var usdt_in_date = await CalcBalancesAsync(item.Data.Balances, item.Timestamp);
                        lvi.SubItems.Add(usdt_in_date.ToGroupedThounsands() + "");
                        lvi.SubItems.Add(bal.USDT.ToGroupedThounsands() + "");

                        lvi.Tag = item;
                        listView_accounthistory.Items.Add(lvi);
                    }
                    if (listView_accounthistory.Items?.Count > 0)
                        listView_accounthistory.Items[0].Selected = true;
                }


                lblstatus.Text = "Ready.";
            }
            catch (Exception er)
            {
                lblstatus.Text = er.Message;
            }
            finally
            {
                if (!OnlyHistory && listView_openOrders.Items?.Count > 0)
                {

                    listView_openOrders.Groups[0].Footer = $"Buy Orders: { _TotalBuy.ToUSDTValue()}";
                    listView_openOrders.Groups[1].Footer = $"Sell Orders: { _TotalSell.ToUSDTValue()}";
                    lblstatus.ToolTipText = $"Estimate Account value after filling all opened sell orders is {(_TotalBuy + _TotalSell + _Totalfree).ToUSDTValue()}.";
                    lblstatus.Text = $"Est. account value  {(_TotalBuy + _TotalSell + _Totalfree).ToUSDTValue()}.";
                }

                RefreshPricesUI();
                listView2.EndUpdate();
                listView_openOrders.EndUpdate();
                Cursor = Cursors.Default;
            }

        }

        void SetTextAsync(BinanceStreamBookPrice a)
        {
            if (InvokeRequired)
            {
                Invoke(new Action<BinanceStreamBookPrice>(SetTextAsync), new object[] { a });
                return;
            }
            string msg = $"{++i}: {a.UpdateId} - { a.Symbol }: {a.BestAskPrice} -> {DateTime.Now}";
            //  label1.Text = msg;
            /* if (i > 10000)
             {
                 var eee= sw.Elapsed;
                 label1.Text = eee.TotalMilliseconds+"";
             }*/

            // toolStripStatusLabel1.Text = msg;
            //  _log.Info(msg);
            // File.AppendAllText(_file,msg);
            //  textBox1.Text = $"{a.UpdateId} - { a.Symbol }: {a.BestAskPrice} -> {DateTime.Now}{Environment.NewLine }";

        }

        private void button1_Click(object sender, EventArgs e)
        {

        }

        int _selected_index = 0;
        private async void listView1_SelectedIndexChanged(object sender, EventArgs e)
        {
            if (listView1.SelectedItems != null && listView1.SelectedItems.Count > 0)
            {
                _selected_index = listView1.SelectedItems[0].Index;
                await RefreshSelectedAccountInfoAsync();
            }
            else
                lblstatus2.Text = "";
        }

        async Task RefreshSelectedAccountInfoAsync(bool Quicksearch = false, bool onlyhistory = false)
        {
            if (listView1.Items == null || listView1.Items.Count <= _selected_index) return;
            var client_balances = ((BinanceClient, IEnumerable<BinanceBalance>))listView1.Items[_selected_index].Tag;
            if (!Quicksearch)
                await RefreshAllPricesAsync();
            await LoadAccountInfoAsync(client_balances.Item1, onlyhistory);

        }
        private async void toolStripButton1_Click(object sender, EventArgs e)
        {
            await LoadAccountsAsync();
        }

        private async void timer1_Tick(object sender, EventArgs e)
        {

            try
            {
                if (!_auto_Refresh) return;
                await LoadAccountsAsync();
            }
            catch
            {


            }
        }
        private ListViewColumnSorter lvwColumnSorter;
        private ListViewColumnSorter lvwColumnSorter2;


        private void listView1_ColumnClick(object sender, ColumnClickEventArgs e)
        {
            // Determine if clicked column is already the column that is being sorted.
            if (e.Column == lvwColumnSorter.SortColumn)
            {
                // Reverse the current sort direction for this column.
                if (lvwColumnSorter.Order == SortOrder.Ascending)
                {
                    lvwColumnSorter.Order = SortOrder.Descending;
                }
                else
                {
                    lvwColumnSorter.Order = SortOrder.Ascending;
                }
            }
            else
            {
                // Set the column number that is to be sorted; default to ascending.
                lvwColumnSorter.SortColumn = e.Column;
                lvwColumnSorter.Order = SortOrder.Ascending;
            }

            // Perform the sort with these new sort options.
            this.listView1.Sort();
        }

        private void toolStripButton2_Click(object sender, EventArgs e)
        {
            Close();
        }

        private void listView2_ColumnClick(object sender, ColumnClickEventArgs e)
        {
            // Determine if clicked column is already the column that is being sorted.
            if (e.Column == lvwColumnSorter2.SortColumn)
            {
                // Reverse the current sort direction for this column.
                if (lvwColumnSorter2.Order == SortOrder.Ascending)
                {
                    lvwColumnSorter2.Order = SortOrder.Descending;
                }
                else
                {
                    lvwColumnSorter2.Order = SortOrder.Ascending;
                }
            }
            else
            {
                // Set the column number that is to be sorted; default to ascending.
                lvwColumnSorter2.SortColumn = e.Column;
                lvwColumnSorter2.Order = SortOrder.Ascending;
            }

            // Perform the sort with these new sort options.
            this.listView2.Sort();
        }
        bool _enablesounds = true;
        private void streamtoolStripButton3_Click(object sender, EventArgs e)
        {
            _enablesounds = streamuserdatatoolStripButton3.Checked;

        }

       
     
        bool showsmallamounts = false;
        private async void showsmallamountstoolStripButton1_Click(object sender, EventArgs e)
        {
            showsmallamounts = !showsmallamounts;
            showsmallamountstoolStripButton1.Checked = showsmallamounts;
            await RefreshSelectedAccountInfoAsync();
        }

        private void lblBTCPrice_MouseDown(object sender, MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Left)
                DragForm();
        }
        bool _auto_Refresh = false ;
        private void autorefreshtoolStripButton1_Click(object sender, EventArgs e)
        {
            _auto_Refresh = autorefreshtoolStripButton1.Checked;
        }

        private async void toolStrip2_ItemClicked(object sender, ToolStripItemClickedEventArgs e)
        {
            if ((e.ClickedItem.Tag + "") != "refreshcurrentaccount")
                foreach (var item in toolStrip2.Items)
                {
                    if (item is ToolStripButton)
                        ((ToolStripButton)item).Checked = false;
                }

            if ((e.ClickedItem.Tag + "") == "wallet")
            {
                listView2.BringToFront();
                ((ToolStripButton)e.ClickedItem).Checked = true;
            }
            else if ((e.ClickedItem.Tag + "") == "openorders")
            {
                listView_openOrders.BringToFront();
                ((ToolStripButton)e.ClickedItem).Checked = true;
            }
            else if ((e.ClickedItem.Tag + "") == "history")
            {
                splitContainer2.Visible = true;
                splitContainer2.BringToFront();
                ((ToolStripButton)e.ClickedItem).Checked = true;
            }
            else if ((e.ClickedItem.Tag + "") == "refreshcurrentaccount")
            {
                await RefreshSelectedAccountInfoAsync();
            }
        }

        private async void quicksearchtoolStripTextBox1_TextChanged(object sender, EventArgs e)
        {
            await RefreshSelectedAccountInfoAsync(true);
        }



        private void listView2_SelectedIndexChanged(object sender, EventArgs e)
        {
            ListView listView = sender as ListView;
            if (listView.SelectedItems?.Count > 0)
            {
                decimal sum = 0;
                decimal sum2 = 0;
                foreach (ListViewItem item in listView.SelectedItems)
                {
                    decimal price = 0;
                    var tag = item.Tag as BinanceBalance;
                    var tag1 = item.Tag as BinanceOrder;
                    if (tag != null)
                    {
                        price = GetSymbolPrice(tag.Asset).USDT;
                        sum += tag.Total * price;
                        sum2 += tag.Total;
                    }
                    else if (tag1 != null)
                    {
                        price = tag1.Price;
                        sum += tag1.Quantity * price;
                        sum2 += tag1.Quantity ;
                    }
                }
                lblstatus2.Text = "Selected assets value: " + sum.ToUSDTValue() + "   ,Count: " + sum2.ToGroupedThounsands();
            }
            else
                lblstatus2.Text = "";
        }

        private async void listView_accounthistory_SelectedIndexChanged(object sender, EventArgs e)
        {
            if (listView_accounthistory.SelectedItems?.Count > 0)
            {
                await LoadAccountHistoryDetailsAsync((BinanceSpotAccountSnapshot)listView_accounthistory.SelectedItems[0].Tag);
            }
        }

        private async void dateTimePicker1_ValueChanged(object sender, EventArgs e)
        {

            await RefreshSelectedAccountInfoAsync(true, true);
        }

        private async void addaccount_toolStripButton_Click(object sender, EventArgs e)
        {
            frmaddnewaccount frmaddnewaccount = new frmaddnewaccount();
            if (frmaddnewaccount.ShowDialog() == DialogResult.OK)
            {
                var api1 = frmaddnewaccount.APIKey;
                var api2 = frmaddnewaccount.SecretKey;
                var api3 = frmaddnewaccount.Comments;

                binanceApiKeys.Add(new BinanceApiKey
                {
                    ApiKey = api1,
                    SecretKey = api2,
                    Comment = api3,

                });

                SaveAccountsJson();

                await LoadAccountsAsync();
            }
        }
        void SaveAccountsJson()
        {
            string jsonString = JsonSerializer.Serialize(binanceApiKeys);
            File.WriteAllText("_accounts.json", jsonString);

            string jsonString1 = JsonSerializer.Serialize(SymbolPrices_Dates);
            File.WriteAllText("_accounts_data.json", jsonString1);
        }

        private void showfloatingwindowtoolStripButton4_Click(object sender, EventArgs e)
        {
            if (showfloatingwindowtoolStripButton4.Checked)
            {
                showfloatingwindowtoolStripButton4.Checked = false;
                frmNotify?.Hide();
                return;
            }
            showfloatingwindowtoolStripButton4.Checked = true;
            if (frmNotify == null)
                frmNotify = new frmNotify(this);
            frmNotify.Show();
        }

        private void Form1_FormClosing(object sender, FormClosingEventArgs e)
        {
            SaveAccountsJson();
        }

        private async void contextMenuStrip1_ItemClicked(object sender, ToolStripItemClickedEventArgs e)
        {
            try
            {
                contextMenuStrip1.Hide();
                if (listView_openOrders.SelectedItems!.Count > 0)
                {
                    var client_balances = ((BinanceClient, IEnumerable<BinanceBalance>))listView1.Items[_selected_index].Tag;
                    if (client_balances.Item1 == null)
                        return;
                    if (MessageBox.Show("Are you sure you want to cancell all selected orders?", "Cancel Orders", MessageBoxButtons.YesNo, MessageBoxIcon.Question) == DialogResult.No)
                        return;
                    Cursor = Cursors.WaitCursor;
                    foreach (ListViewItem item in listView_openOrders.SelectedItems)
                    {
                        var ii = item.Tag as BinanceOrder;
                        if (ii == null) continue;
                        
                        var c = await client_balances.Item1.SpotApi.Trading.CancelOrderAsync(ii.Symbol,newClientOrderId: ii.ClientOrderId);
                        if (c.Success)
                            item.Remove();
                        else                        
                            throw new Exception(c.Error.Message);

                       
                    }
                }


            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                Cursor = Cursors.Default;
            }

        }

        private async void sellMarketToolStripMenuItem_Click(object sender, EventArgs e)
        {
            contextMenuStrip2.Hide();
            if (listView2.SelectedItems == null || listView2.SelectedItems.Count == 0) return;
            var _coin = listView2.SelectedItems[0].Text;

            var client_balances = ((BinanceClient, IEnumerable<BinanceBalance>))listView1.Items[_selected_index].Tag;
            if (client_balances.Item1 == null)
                return;
          
            string _msg = "Are you sure you want to sell at current market price?";
            if (MessageBox.Show(_msg, "Sell At Current Market Price?", MessageBoxButtons.YesNo, MessageBoxIcon.Question) == DialogResult.No) return;
            var o =await  client_balances.Item1.SpotApi.Trading.PlaceOrderAsync(_coin + "USDT", Binance.Net.Enums.OrderSide.Sell, Binance.Net.Enums.SpotOrderType.Market, 10);
        }
    }


    public class SymbolPriceDate
    {
        public string Symbol { get; set; }
        public decimal Price_Close { get; set; }
        public DateTime Date_Close { get; set; }
        public bool IsValidSymbol { get; set; } = true;
    }
    public class BinanceApiKey
    {
        public string ApiKey { get; set; }
        public string SecretKey { get; set; }
        public string Comment { get; set; }
        [NonSerialized]
        BinanceClient _Client = null;

        public BinanceClient Client
        {
            get
            {
                if (_Client == null && !string.IsNullOrWhiteSpace(ApiKey) && !string.IsNullOrWhiteSpace(SecretKey))
                    _Client = new BinanceClient(new BinanceClientOptions
                    {
                        ApiCredentials = new ApiCredentials(ApiKey, SecretKey),
                        ReceiveWindow = TimeSpan.FromMilliseconds(60000),
                    });
                return _Client;
            }
        }

        public BinanceApiKey()
        {
            System.Timers.Timer timer = new System.Timers.Timer(5 * 60 * 1000);            
            timer.Elapsed += OnTick; // Which can also be written as += new ElapsedEventHandler(OnTick);
            timer.Start();
        }

        public bool UserStreamRegistered { get; set; } = false;
        public event UserUpdateHandler UserUpdates;
        public delegate void UserUpdateHandler(string Client_Alias, BinanceStreamOrderUpdate streamOrderUpdate, BinanceStreamPositionsUpdate streamPositionsUpdate);
        public string StreamListemKey { get; set; }
        public BinanceStreamBalance   AccountInfo { get; set; } 
        internal async void StartStreamAsync()
        {
            if (Client == null)
                throw new Exception("You have to set the API Keys.");

            var startResult = await _Client.SpotApi.Account.StartUserStreamAsync();
            if (!startResult.Success)
                throw new Exception($"Failed to start user stream: {startResult.Error}");

            var socketClient = new BinanceSocketClient();
            StreamListemKey = startResult.Data;
          await   socketClient.SpotStreams.SubscribeToUserDataUpdatesAsync(startResult.Data,
                accountUpdate =>
                {
                    UserUpdates?.Invoke(this.Comment, accountUpdate.Data, null);
                   // AccountInfo = accountUpdate.Data;                    

                },
                orderUpdate =>
                { // Handle order update
                   // UserUpdates?.Invoke(this.Comment, orderUpdate.Data, null);
                },
                ocoUpdate =>
                { // Handle oco order update
                },
                positionUpdate =>
                { // Handle account position update
                  // UserUpdates?.Invoke(this.Comment,null, positionUpdate);
                }
              
                );
        }

        internal async Task StopStreamAsync()
        {
            if (Client == null)
                throw new Exception("You have to set the API Keys.");

            var startResult = await _Client.SpotApi.Account .StopUserStreamAsync(StreamListemKey);
            if (!startResult.Success)
                throw new Exception($"Failed to stop user stream: {startResult.Error}");
            StreamListemKey = null;
        }



        private async void OnTick(object source, ElapsedEventArgs e)
        {
            if (_Client != null && !string.IsNullOrWhiteSpace(StreamListemKey))
                await _Client.SpotApi.Account .KeepAliveUserStreamAsync(StreamListemKey);
        }
    }

    public class BinanceMiniTick : IBinanceMiniTick
    {
        public string Symbol { get; set; }
        public decimal LastPrice { get; set; }
        public decimal OpenPrice { get; set; }
        public decimal HighPrice { get; set; }
        public decimal LowPrice { get; set; }
        public decimal BaseVolume { get; set; }
        public decimal QuoteVolume { get; set; }
        public DateTime? TimeStamp { get; set; }
        public decimal Volume { get ; set ; }
    }
}

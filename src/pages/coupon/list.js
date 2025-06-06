const i18n = require('../../utils/i18n/index');
const { api } = require('../../utils/request');

Page({
  data: {
    currentTab: 'available',
    tabs: [],
    coupons: [],
    filteredCoupons: [],
    loading: true,
    error: false,
    // 兑换相关
    showExchangeModal: false,
    exchangeCode: '',
    exchangeLoading: false
  },
  
  onLoad: function() {
    // 注册国际化页面
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.i18nPages = app.globalData.i18nPages || [];
      app.globalData.i18nPages.push(this);
    }
    
    // 更新国际化文本
    this.updateI18nText();
    
    // 加载优惠券数据
    this.loadCouponData();
  },
  
  onShow: function() {
    // 返回页面时刷新数据
    this.loadCouponData();
  },
  
  // 加载优惠券数据
  loadCouponData: function() {
    this.setData({
      loading: true,
      error: false
    });
    
    api.coupon.getList().then(res => {
      this.setData({
        coupons: res.data?.coupons || [],
        loading: false
      });
      this.filterCoupons();
    }).catch(err => {
      console.error('获取优惠券列表失败:', err);
      this.setData({
        error: true,
        loading: false
      });
    });
  },
  
  // 更新页面的国际化文本
  updateI18nText: function() {
    // 更新标题
    wx.setNavigationBarTitle({
      title: i18n.t('page.coupon')
    });
    
    // 更新页面文本
    this.setData({
      i18n: {
        empty: i18n.t('coupon.empty'),
        use: i18n.t('coupon.use'),
        used: i18n.t('coupon.used'),
        expired: i18n.t('coupon.expired'),
        validPeriod: i18n.t('coupon.validPeriod')
      },
      tabs: [
        { name: i18n.t('coupon.tabs.available'), value: 'available' },
        { name: i18n.t('coupon.tabs.used'), value: 'used' },
        { name: i18n.t('coupon.tabs.expired'), value: 'expired' }
      ]
    });
  },
  
  filterCoupons: function() {
    const filteredCoupons = this.data.coupons.filter(coupon => coupon.status === this.data.currentTab);
    this.setData({
      filteredCoupons: filteredCoupons
    });
  },
  
  switchTab: function(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({
      currentTab: value
    });
    this.filterCoupons();
  },
  
  useCoupon: function(e) {
    const coupon = e.currentTarget.dataset.coupon;
    
    // 检查优惠券状态
    if (coupon.status !== 'available') {
      wx.showToast({
        title: '优惠券不可用',
        icon: 'none'
      });
      return;
    }
    
    // 存储选中的优惠券信息
    wx.setStorageSync('selectedCoupon', coupon);
    
    // 跳转到商品列表页面
    wx.navigateTo({
      url: '/pages/product/list'
    });
    
    wx.showToast({
      title: '优惠券已选择，请选择商品',
      icon: 'success'
    });
  },
  
  // 显示兑换弹窗
  showExchangeModal: function() {
    this.setData({
      showExchangeModal: true,
      exchangeCode: ''
    });
  },
  
  // 隐藏兑换弹窗
  hideExchangeModal: function() {
    this.setData({
      showExchangeModal: false,
      exchangeCode: '',
      exchangeLoading: false
    });
  },
  
  // 输入兑换码
  onExchangeCodeInput: function(e) {
    this.setData({
      exchangeCode: e.detail.value.trim()
    });
  },
  
  // 确认兑换
  confirmExchange: function() {
    const { exchangeCode } = this.data;
    
    if (!exchangeCode) {
      wx.showToast({
        title: '请输入兑换码',
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      exchangeLoading: true
    });
    
    api.coupon.exchange(exchangeCode).then(res => {
      this.setData({
        exchangeLoading: false
      });
      
      if (res.success) {
        wx.showToast({
          title: res.message || '兑换成功',
          icon: 'success'
        });
        
        // 隐藏弹窗
        this.hideExchangeModal();
        
        // 刷新优惠券列表
        this.loadCouponData();
      } else {
        wx.showToast({
          title: res.message || '兑换失败，请检查兑换码',
          icon: 'none',
          duration: 2000
        });
      }
      
    }).catch(err => {
      this.setData({
        exchangeLoading: false
      });
      
      console.error('兑换优惠券失败:', err);
      
      wx.showToast({
        title: err.message || '网络异常，请稍后重试',
        icon: 'none',
        duration: 2000
      });
    });
  }
})
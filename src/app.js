const i18n = require('./utils/i18n/index');
const EventEmitter = require('./utils/event-emitter');
const { checkLogin } = require('./utils/auth');
const { api } = require('./utils/request');

App({
  globalData: {
    userInfo: null,
    takeWayIndex: 0, // 默认为外卖模式
    language: i18n.getCurrentLang(), // 当前语言
    lastLanguage: i18n.getCurrentLang(), // 上一次的语言
    i18nPages: [], // 注册了国际化的页面
    eventBus: new EventEmitter() // 全局事件总线，用于通知语言变更
  },
  
  onLaunch() {
    // 检查本地存储中是否有用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.globalData.userInfo = userInfo;
    }
    
    // 初始化购物车角标
    this.updateCartBadge();
    
    // 初始化国际化
    this.initializeI18n();
  },
  
  // 初始化国际化
  initializeI18n() {
    // 从缓存获取当前语言设置
    const language = wx.getStorageSync('language');
    if (language) {
      this.globalData.language = language;
      this.globalData.lastLanguage = language;
    } else {
      // 初次使用，保存默认语言到缓存
      wx.setStorageSync('language', this.globalData.language);
    }
    
    // 设置底部导航栏国际化
    this.updateTabBarI18n();
    
    // 监听语言变更事件
    this.globalData.eventBus.on('languageChanged', this.handleLanguageChanged.bind(this));
  },
  
  // 处理语言变更事件
  handleLanguageChanged(lang) {
    if (!lang) return;
    
    // 更新全局语言设置
    this.globalData.language = lang;
    
    // 保存到缓存
    wx.setStorageSync('language', lang);
    
    // 更新底部导航栏国际化
    this.updateTabBarI18n();
    
    // 通知所有已注册的页面更新国际化文本
    this.updateAllPagesI18n();
  },
  
  // 语言切换函数
  switchLanguage(lang) {
    if (!lang || lang === this.globalData.language) return;
    
    // 触发语言变更事件
    this.globalData.eventBus.emit('languageChanged', lang);
  },
  
  // 更新所有国际化页面
  updateAllPagesI18n() {
    const pages = this.globalData.i18nPages || [];
    
    // 遍历所有已注册的页面，调用其updateI18nText方法
    pages.forEach(page => {
      if (page && typeof page.updateI18nText === 'function') {
        page.updateI18nText();
      }
    });
  },
  
  // 更新底部导航栏国际化
  updateTabBarI18n() {
    try {
      // 获取国际化文本
      const tabBarTexts = {
        home: i18n.t('tabbar.home') || '首页',
        shop: i18n.t('tabbar.shop') || '商城',
        cart: i18n.t('tabbar.cart') || '购物车',
        order: i18n.t('tabbar.order') || '订单',
        profile: i18n.t('tabbar.profile') || '我的'
      };
      
      console.log('设置底部导航栏国际化文本:', tabBarTexts);
      
      const tabBarItems = [
        { index: 0, text: tabBarTexts.home },
        { index: 1, text: tabBarTexts.shop },
        { index: 2, text: tabBarTexts.cart },
        { index: 3, text: tabBarTexts.order },
        { index: 4, text: tabBarTexts.profile }
      ];
      
      // 使用延迟设置确保组件已渲染
      setTimeout(() => {
        // 更新每个底部标签的文本
        tabBarItems.forEach(item => {
          this.safeSetTabBarItem(item.index, item.text);
        });
      }, 100);
      
      // 更新导航栏标题
      wx.setNavigationBarTitle({
        title: i18n.t('app.title') || 'SPRINKLE水商城',
        fail: (err) => {
          console.error('设置导航栏标题失败:', err);
        }
      });
    } catch (err) {
      console.error('更新TabBar国际化失败:', err);
      // 失败后尝试延迟再次更新
      setTimeout(() => {
        try {
          this.updateTabBarI18n();
        } catch (retryErr) {
          console.error('重试更新TabBar国际化也失败:', retryErr);
        }
      }, 3000);
    }
  },
  
  // 安全设置TabBar项
  safeSetTabBarItem(index, text, maxRetries = 3) {
    let retryCount = 0;
    
    const trySetTabBarItem = () => {
      wx.setTabBarItem({
        index: index,
        text: text,
        success: () => {
          console.log(`设置TabBar第${index}项文本成功: ${text}`);
        },
        fail: (err) => {
          console.error(`设置TabBar第${index}项文本失败:`, err);
          retryCount++;
          
          if (retryCount < maxRetries) {
            console.log(`第${retryCount}次重试设置TabBar第${index}项文本...`);
            // 延迟时间随着重试次数增加
            setTimeout(trySetTabBarItem, 1000 * retryCount);
          }
        }
      });
    };
    
    trySetTabBarItem();
  },
  
  // 更新购物车Tab徽标
  updateTabBarBadge(count) {
    if (count > 0) {
      wx.setTabBarBadge({
        index: 2, // 购物车的索引（首页、商城、购物车、订单、我的）
        text: count.toString()
      }).catch(err => {
        console.log('设置TabBar徽标失败：', err);
      });
    } else {
      wx.removeTabBarBadge({
        index: 2
      }).catch(err => {
        console.log('移除TabBar徽标失败：', err);
      });
    }
  },

  // 从API获取购物车数量并更新角标
  updateCartBadge() {
    console.log('=== 开始更新购物车角标 ===');
    
    // 检查是否已登录
    const isLoggedIn = checkLogin({ redirectOnFail: false, showToast: false });
    console.log('登录状态:', isLoggedIn);
    
    if (!isLoggedIn) {
      // 未登录，移除角标
      console.log('用户未登录，移除角标');
      this.updateTabBarBadge(0);
      return Promise.resolve(0);
    }
    
    // 检查token是否存在
    const token = wx.getStorageSync('token');
    console.log('Token存在:', !!token);
    if (!token) {
      console.log('Token不存在，移除角标');
      this.updateTabBarBadge(0);
      return Promise.resolve(0);
    }
    
    // 已登录，从API获取购物车数量
    console.log('开始调用购物车数量API...');
    return api.getCartCount()
      .then(res => {
        console.log('购物车数量API响应:', res);
        if (res && res.success && typeof res.data?.count === 'number') {
          const count = res.data.count;
          console.log(`设置角标数量: ${count}`);
          this.updateTabBarBadge(count);
          return count;
        } else {
          console.warn('购物车数量API返回数据格式异常:', res);
          this.updateTabBarBadge(0);
          return 0;
        }
      })
      .catch(err => {
        console.error('获取购物车数量失败:', err);
        
        // 如果是认证错误，清除登录状态并移除角标
        if (err && (err.needLogin || err.message?.includes('登录'))) {
          console.log('认证失败，清除登录状态');
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('isLoggedIn');
          this.updateTabBarBadge(0);
        } else {
          // 其他错误，暂时不更新角标
          console.log('其他错误，保持当前角标状态');
        }
        return 0;
      });
  },

  onShow() {
    // 小程序显示时执行
    console.log('App onShow');
    
    // 检查语言是否有变化
    const storageLanguage = wx.getStorageSync('language');
    if (storageLanguage && storageLanguage !== this.globalData.language) {
      console.log('检测到语言变化，从', this.globalData.language, '变为', storageLanguage);
      this.globalData.language = storageLanguage;
      this.updateTabBarI18n();
    } else {
      // 即使语言没有变化，也尝试更新TabBar，确保文本显示正确
      console.log('刷新底部导航栏国际化文本');
      // 使用setTimeout确保界面已经准备好
      setTimeout(() => {
        this.updateTabBarI18n();
      }, 300);
    }
  },
  
  onHide() {
    // 小程序隐藏时执行
    console.log('App onHide')
  },
  
  onError(err) {
    // 小程序发生错误时执行
    console.log('App onError: ', err)
  }
}) 
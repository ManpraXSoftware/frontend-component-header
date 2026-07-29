import React, { Component } from 'react';
import HeaderLogo from "./header-logo";
import accessibilityIcon from './assets/accessibilityIcon.png';
import axios from 'axios';
import Cookies from 'js-cookie';
import { AppContext } from '@edx/frontend-platform/react';
import { getConfig } from '@edx/frontend-platform';
import CaretDropDownIcon from './Icons';
import $ from 'jquery'; 
import AudioSearch from './AudioSearch';
import FocusTrap from 'focus-trap-react';

class Header extends Component {
  static contextType = AppContext;
  
    constructor(props) {
      super(props);
      this.state = {
        darkLanguages: [],
        languages: [],
        lang_key: '',
        setText: '',
        isMobileMenuOpen: false,
        resumeCourseUrl: null,
        profileUrl: '',
      };
      this.isClosing = false;
  
      this.dropdownRef = React.createRef();
      this.nonDropdownNodes = []; // Track disabled non-dropdown nodes
      this.focusableSelector = `
        a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), 
        textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"], 
        [tabindex="0"], area[href], details, summary, iframe, object, embed,
        li[data-testid="breadcrumb-item"], li[data-testid="breadcrumb-item"] a, 
        li[data-testid="breadcrumb-item"] button, li[data-testid="breadcrumb-item"] [tabindex],
        div[class*="sequence-navigation-tabs-container"], div[class*="sequence-navigation-tabs d-flex flex-grow-1"]
      `.trim(); // Focusable selector for trap
    }
  
    componentDidMount() {
      var darkLang = []
      const { authenticatedUser } = this.context;
  
      if (!authenticatedUser || !authenticatedUser.email) {
        const loginUrl = getConfig().LOGIN_URL;
        window.location.href = loginUrl;
        return; // Stop further execution
      }
  
      const gaId = getConfig().GOOGLE_ANALYTICS_ID;
      if (gaId && !window.gtag) {
        window.dataLayer = window.dataLayer || [];
        window.gtag = function gtag() { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', gaId);
        const gaScript = document.createElement('script');
        gaScript.async = true;
        gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
        document.head.appendChild(gaScript);
      }
  
      if (!this.state.setText) {
        const search_query = new URLSearchParams(location.search).get("text");
        this.setState({ setText: search_query || '' });
      }
      
      var current_lang = Cookies.get('lang', { domain: getConfig().SITE_DOMAIN[0], path: '/', secure: false, sameSite: "Lax" })
      if (!current_lang) { // Check for undefined, null, or empty string
        current_lang = 'en';
      }
      const jf = document.createElement('script');
  
  
      const mx_localizekey = Array.isArray(getConfig().MX_LOCALIZEKEY) 
      ? getConfig().MX_LOCALIZEKEY[0] 
      : getConfig().MX_LOCALIZEKEY;
  
  
      const show_user_way = getConfig().SHOW_USER_WAY[0];
      if(show_user_way == "True"){
        const script = document.createElement('script');
        const user_way_key = getConfig().USER_WAY_KEY[0];
        script.src = 'https://cdn.userway.org/widget.js';
        script.setAttribute('data-account', user_way_key);
        script.async = true;
        document.body.appendChild(script);
      }
  
  
      jf.type = 'text/javascript';
      jf.id = 'external_js';
      jf.setAttribute("lms_base_url", getConfig().LMS_BASE_URL+'/')
      const parentDiv = document.getElementById('nett-head');
      const localizeScript = document.createElement('script');
      localizeScript.src = "https://global.localizecdn.com/localize.js";
      const jqueryScript = document.createElement('script');
      jqueryScript.src = "https://code.jquery.com/jquery-3.7.1.js";
      jqueryScript.integrity = "sha256-eKhayi8LEQwp4NKxN+CfCh+3qOVUtJn3QNZ0TciWLP4=";
      jqueryScript.crossOrigin = "anonymous";
      const localizeInnerText = document.createElement("script");
      localizeInnerText.innerText = !function (a) { if (!a.Localize) { a.Localize = {}; for (var e = ["translate", "untranslate", "phrase", "initialize", "translatePage", "setLanguage", "getLanguage", "getSourceLanguage", "detectLanguage", "getAvailableLanguages", "untranslatePage", "bootstrap", "prefetch", "on", "off", "hideWidget", "showWidget"], t = 0; t < e.length; t++)a.Localize[e[t]] = function () { } } }(window);
      const localizeKey = document.createElement("script");
      localizeKey.innerText = Localize.initialize({ key: mx_localizekey, rememberLanguage: true, retranslateOnNewPhrases: true});
      const langSelect = document.createElement("select");
      langSelect.id = "langOptions";
      langSelect.className = "myLang";
      langSelect.setAttribute("notranslate", "");
      langSelect.ariaLabel = "Selected language";
      parentDiv.append(jf);
      parentDiv.append(jqueryScript);
      parentDiv.append(localizeInnerText);
      parentDiv.append(localizeKey);
      parentDiv.append(langSelect);
      const bodyDiv = document.body;
      bodyDiv.append(localizeScript);
      langSelect.addEventListener('change', this.handleLangOptionsClick);
      let selectTag = document.getElementById("langOptions");
      const lang_dict = []
  
      localizeScript.onload = () => {
        console.log("initialing localizer ...")
        Localize.initialize({ key: mx_localizekey, rememberLanguage: true, retranslateOnNewPhrases: true });
        
        Localize.getAvailableLanguages((error, data) => {
          if (error) {
            console.error('Error fetching available languages:', error);
          } else {
  
            data.map((e, i) => {
              var lang_name = e.name;
              if (e.code == "hi-IN" || e.code == "hi") {
                lang_name = e.name + "(Hindi)";
              } else if (e.code == "kn") {
                lang_name = e.name + "(Kannada)";
              } else if (e.code == "bn") {
                lang_name = e.name + "(Bangali)"
              }
              else if (e.code == "en") {
                lang_name = e.name + "(English)"
              } else if (e.code == "ta-IN") {
                lang_name = "தமிழ்(Tamil)"
              } else if (e.code == "or") {
                lang_name = e.name + "(Odia)"
              } else if (e.code == "ml-IN" || e.code == "ml") {
                lang_name = e.name + "(Malayalam)"
              }
              lang_dict.push({ "name": lang_name, "code": e.code })
      
            })
  
            console.log('Available languages:', data);
          }
        });
  
        axios.get(getConfig().LMS_BASE_URL + `/mx-user-info/get_user_profile?email=${authenticatedUser.email}`,).then((res) => {
          document.getElementById("header-username").innerText = res.data.username;
          document.getElementById("profileimageid").src = getConfig().LMS_BASE_URL + res.data.profileImage.medium;
          document.getElementById("user-profiler-redirect").href = getConfig().ACCOUNT_PROFILE_URL + '/u/' +res.data.username;
    
          const dashboardDiv = document.getElementById('dashboard-navbar');
          if (dashboardDiv && res.data.resume_block) {
              const newDiv = document.createElement('div');
              newDiv.className = 'mobile-nav-item dropdown-item dropdown-nav-item';
              newDiv.innerHTML = `<a href=${res.data.resume_block} role="menuitem">Resume your last course</a>`;
              dashboardDiv.parentNode.insertBefore(newDiv, dashboardDiv);
          };
          
          this.setState({
            resumeCourseUrl: res.data.resume_block || null,
            profileUrl: `${getConfig().ACCOUNT_PROFILE_URL}/u/${res.data.username}`,
          });
    
          for (let i = 0; i < res.data.dark_languages.length; i++) {
            var code = res.data.dark_languages[i][0]
            var name = res.data.dark_languages[i][1]
    
    
            if (code != 'en') {
              if (code == "hi-IN" || code == "hi") {
                name = name + "(Hindi)";
              } else if (code == "kn") {
                name = name + "(Kannada)";
              } else if (code == "bn") {
                name = name + "(Bangali)"
              } else if (code == "en") {
                name = name + "(English)"
              } else if (code == "ta-IN") {
                name = "தமிழ்(Tamil)"
              } else if (code == "or") {
                name = name + "(Odia)"
              } else if (code == "ml-IN" || code == "ml") {
                name = name + "(Malayalam)"
              }
              else if (code == "gu") {
                name = name + "(Gujrati)"
              }
    
              darkLang.push(code)
              lang_dict.push({ "name": name, "code": code })
            }
          }
          
          this.setState({ languages: lang_dict })
    
          this.state.languages.map((lang, i) => {
            var option = new Option(lang.name, lang.code)
            selectTag.append(option)
          })
          const options = selectTag.options
          for (let i = 0; i < options.length; i++) {
            if (current_lang == options[i].value) {
              options[i].setAttribute("selected", true)
              Localize.setLanguage(current_lang);
              Cookies.set('lang', current_lang, { domain: getConfig().SITE_DOMAIN[0], path: '/', secure: false, sameSite: "Lax" })
  
            }
            else{
              options[i].removeAttribute("selected", true)
            }
          }
        })
      };
      
      
      this.setState({ darkLanguages: darkLang })
      $('#langOptions > option').each(function () {
        if (current_lang == $(this).val()) {
          $(this).attr('selected', true);
        } else {
          $(this).removeAttr("selected");
        }
      })
  
      // Hide languages Dropdown on course page 
      let current_url = window.location.href;
      if (current_url.includes('learning/course/') ) {
        $(".myLang").hide();
      }
  
      // Add document click listener
      document.addEventListener('click', this.handleClickOutside);
      document.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('pageshow', this.handleBfcacheRestore);
    }
  
    componentWillUnmount() {
      document.removeEventListener('click', this.handleClickOutside);
      document.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('pageshow', this.handleBfcacheRestore);
    }
  
    handleBfcacheRestore = (event) => {
      if (event.persisted) {
        const edxloggedin = document.cookie.split(';').find(c => c.trim().startsWith('edxloggedin='));
        const isLoggedIn = edxloggedin && edxloggedin.trim().split('=')[1] === 'true';
        if (!isLoggedIn) {
          window.location.replace(getConfig().LOGIN_URL);
        }
      }
    }
  
    // Focus trap for user dropdown (adapted from AudioSearch logic: disable/restore, no wrapping)
    // trapFocusInDropdown = (shouldTrap = true) => {
    //   const dropdown = document.getElementById('user-menu');
    //   if (!dropdown) return;
  
  
    //   if (shouldTrap) {
    //     // Collect and disable non-dropdown focusables (matching your original logic)
    //     const dropdownNodes = Array.from(dropdown.querySelectorAll('*'));
    //     const nonDropdownNodes = Array.from(document.querySelectorAll(`body *:not(#user-menu):not(#user-menu *)`)).filter(node => node.matches(this.focusableSelector));
  
    //     this.nonDropdownNodes = [];
    //     for (let i = 0; i < nonDropdownNodes.length; i++) {
    //       const node = nonDropdownNodes[i];
    //       if (!dropdownNodes.includes(node)) {
    //         node._prevTabindex = node.hasAttribute('tabindex') ? node.getAttribute('tabindex') : 'none';
    //         node.setAttribute('tabindex', '-1');
    //         node.style.outline = 'none';
    //         this.nonDropdownNodes.push(node);
    //       }
    //     }
  
    //     // Focus first focusable in dropdown
    //     const firstFocusable = document.querySelector('#user-menu a[role="menuitem"]'); // First menu item
    //     if (firstFocusable) {
    //       firstFocusable.focus();
    //     }
  
    //     console.log('Dropdown focus trap applied', { 
    //       dropdownNodes: dropdownNodes.length, 
    //       nonDropdownNodes: nonDropdownNodes.length,
    //       timestamp: new Date().toISOString() 
    //     });
    //   } else if (this.nonDropdownNodes.length > 0) {
    //     // Restore non-dropdown focusables (matching your original logic)
    //     const failedRestorations = [];
    //     for (let i = 0; i < this.nonDropdownNodes.length; i++) {
    //       const node = this.nonDropdownNodes[i];
    //       if (node._prevTabindex !== 'none') {
    //         node.setAttribute('tabindex', node._prevTabindex);
    //       } else {
    //         node.removeAttribute('tabindex');
    //       }
    //       node.style.outline = '';
    //       if (node.hasAttribute('tabindex') && node.getAttribute('tabindex') === '-1') {
    //         failedRestorations.push({ tag: node.tagName, id: node.id, class: node.className });
    //       }
    //       node._prevTabindex = null;
    //     }
  
    //     console.log('Dropdown tabindex restored', {
    //       restoredNodes: this.nonDropdownNodes.length,
    //       failedRestorations,
    //       timestamp: new Date().toISOString(),
    //     });
  
    //     // Return focus to trigger (user image div)
    //     const toggleButton = document.querySelector('.user_custom_login');
    //     if (toggleButton) {
    //       toggleButton.focus();
    //       console.log('Focused user image after dropdown close', {
    //         tag: toggleButton.tagName,
    //         id: toggleButton.id,
    //         class: toggleButton.className,
    //         timestamp: new Date().toISOString(),
    //       });
    //     } else {
    //       // Fallback to first page focusable
    //       const firstPageFocusable = document.querySelector(this.focusableSelector);
    //       if (firstPageFocusable) {
    //         firstPageFocusable.focus();
    //         console.log('Focused first page element after dropdown close', {
    //           tag: firstPageFocusable.tagName,
    //           id: firstPageFocusable.id,
    //           class: firstPageFocusable.className,
    //           timestamp: new Date().toISOString(),
    //         });
    //       }
    //     }
  
    //     this.nonDropdownNodes = [];
    //   }
    // };
  
    handleSearchClick = (e) => {
      e.preventDefault();
      let searchData = this.state.setText;
      if (searchData !== '') {
        let url = getConfig().EXPLORE_COURSE_URL[0] + `/search?text=${encodeURIComponent(searchData)}`;
        window.location = url;
        this.setState({ setText: '' });
      }
    };
  
    // method to toggle mobile menu
    toggleMobileMenu = () => {
      this.setState((prevState) => ({
        isMobileMenuOpen: !prevState.isMobileMenuOpen,
      }));
    };
  
    handleClickOutside = (event) => {
      const userMenu = document.getElementById("user-menu");
      const toggleButtons = document.querySelectorAll(".toggle-user-dropdown");
      const mobileMenu = document.getElementById("mobile-menu");
      const hamburgerButton = document.querySelector(".hamburger-menu");
      
      if (userMenu && !userMenu.classList.contains("hidden") && 
          !event.target.closest('.secondary') &&
          !event.target.closest('#user-menu')) {
        const isOpen = !userMenu.classList.contains("hidden"); // Before close
        userMenu.classList.add("hidden");
        toggleButtons.forEach((btn) => btn.setAttribute("aria-expanded", "false"));
        // if (isOpen) {
        //   this.trapFocusInDropdown(false); // Release trap on close
        // }
      }
  
      if (this.state.isMobileMenuOpen && mobileMenu && 
          !event.target.closest('#mobile-menu') && 
          !event.target.closest('.hamburger-menu')) {
        this.setState({ isMobileMenuOpen: false });
        hamburgerButton.setAttribute("aria-expanded", "false");
      }
    };
  
    handleKeyDown = (event) => {
      const userMenu = document.getElementById("user-menu");
      const toggleButtons = document.querySelectorAll(".toggle-user-dropdown");
      const mobileMenu = document.getElementById("mobile-menu");
      const hamburgerButton = document.querySelector(".hamburger-menu");
  
      if (event.key === 'Escape') {
        if (userMenu && !userMenu.classList.contains("hidden")) {
          const isOpen = !userMenu.classList.contains("hidden"); // Before close
          userMenu.classList.add("hidden");
          toggleButtons.forEach((btn) => btn.setAttribute("aria-expanded", "false"));
          const toggleButton = document.querySelector(".user_custom_login");
          if (toggleButton) toggleButton.focus();
          // if (isOpen) {
          //   this.trapFocusInDropdown(false); // Release trap on close
          // }
        }
        if (this.state.isMobileMenuOpen && mobileMenu) {
          this.setState({ isMobileMenuOpen: false });
          hamburgerButton.setAttribute("aria-expanded", "false");
          hamburgerButton.focus();
        }
      }
  
      if (event.altKey && event.code === 'KeyC') {
          event.preventDefault();
          event.stopPropagation();
          window.location.href = '/explore-courses/';
          return;
        }
  
        // Arrow key navigation for user dropdown (only when open)
        if (!userMenu || userMenu.classList.contains("hidden")) return; // Skip if not open
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); // Prevent default scrolling
          const menuItems = Array.from(userMenu.querySelectorAll('a[role="menuitem"]')); // All focusable menuitems
          if (menuItems.length === 0) return;
          
          const currentIndex = menuItems.findIndex(item => document.activeElement === item);
          let nextIndex;
          if (event.key === 'ArrowDown') {
            nextIndex = currentIndex < menuItems.length - 1 ? currentIndex + 1 : 0; // Loop to top
          } else {
            nextIndex = currentIndex > 0 ? currentIndex - 1 : menuItems.length - 1; // Loop to bottom
          }
          menuItems[nextIndex].focus(); // Move focus
        }
  
    };
  
    handleLangOptionsClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
    
        const selectedLang = e.target.value; // Get the selected language code
        const currentLang = Cookies.get('lang', { domain: getConfig().SITE_DOMAIN[0], path: '/', secure: false, sameSite: "Lax" });
    
        // If the selected language is the same as the current language, do nothing
        if (selectedLang === currentLang) {
          return;
        }
    
        let current_url = window.location.href;
        let base_url = window.location.origin;
        let text = "Do you want to change the language? You will be redirected to the 'explore courses' page";
    
        if (current_url.includes('explore-courses/program-courses') || 
            current_url.includes('explore-courses/#main') || 
            current_url === `${base_url}/explore-courses/` || 
            current_url === `${base_url}/explore-courses` || 
            current_url === `${base_url}/explore-courses/dashboard/programs/` || 
            current_url === `${base_url}/explore-courses/dashboard/` || 
            current_url.startsWith(`${base_url}/explore-courses/dashboard/`) ||
            current_url.includes('explore-courses/search') ) {
            this.chngLang(e);
        }
        else {
          // Use a custom confirmation dialog
          this.showCustomConfirmDialog(text, () => {
              this.chngLang(e);
          }, () => {
              const langSelect = document.getElementById('langOptions');
              langSelect.value = currentLang;
          });
      }
      }
  
      // Custom confirmation dialog
      showCustomConfirmDialog = (message, onConfirm, onCancel) => {
        // Create dialog elements
        const modal = document.createElement('div');
        modal.setAttribute('id', 'customConfirmModal');
        modal.setAttribute('tabindex', '-1');
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '1000';
    
        const dialog = document.createElement('div');
        dialog.style.backgroundColor = '#fff';
        dialog.style.padding = '20px';
        dialog.style.borderRadius = '8px';
        dialog.style.textAlign = 'center';
        dialog.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    
        const messageElem = document.createElement('p');
        messageElem.textContent = message;
        messageElem.setAttribute('tabindex', '0'); // Make it focusable
    
        const confirmButton = document.createElement('button');
        confirmButton.textContent = 'Confirm';
        confirmButton.style.margin = '0 10px';
  
        var modalNodes = Array.from( document.querySelectorAll('#customConfirmModal *') );
        var nonModalNodes = document.querySelectorAll('body *:not(#customConfirmModal):not([tabindex="-1"])');
            for (var i = 0; i < nonModalNodes.length; i++) {
              var node = nonModalNodes[i];
              if (!modalNodes.includes(node)) {
                node._prevTabindex = node.getAttribute('tabindex');
                node.setAttribute('tabindex', -1);
                node.style.outline = 'none';
              }
            }
  
        confirmButton.onclick = () => {
            document.body.removeChild(modal);
            onConfirm();
        };
    
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.style.margin = '0 10px';
        cancelButton.onclick = () => {
            document.body.removeChild(modal);
            onCancel();
  
            document.body.style.overflow = null;
            for (var i = 0; i < nonModalNodes.length; i++) {
              var node = nonModalNodes[i];
              if (node._prevTabindex) {
                node.setAttribute('tabindex', node._prevTabindex);
                node._prevTabindex = null;
              }
              else {
                node.removeAttribute('tabindex');
              }
              node.style.outline = null;
            }
  
        };
    
        // Append elements
        dialog.appendChild(messageElem);
        dialog.appendChild(confirmButton);
        dialog.appendChild(cancelButton);
        modal.appendChild(dialog);
        document.body.appendChild(modal);
    
        // Focus on the message element
        messageElem.focus();
  
        // Close modal on outside click
      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            document.body.removeChild(modal);
            onCancel();
  
            document.body.style.overflow = null;
            for (var i = 0; i < nonModalNodes.length; i++) {
              var node = nonModalNodes[i];
              if (node._prevTabindex) {
                node.setAttribute('tabindex', node._prevTabindex);
                node._prevTabindex = null;
              }
              else {
                node.removeAttribute('tabindex');
              }
              node.style.outline = null;
            }
            
        }
    });
  
    //Start Close modal on ESC key press
    modal.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
          document.body.removeChild(modal);
          onCancel();
          document.body.style.overflow = null;
          for (var i = 0; i < nonModalNodes.length; i++) {
              var node = nonModalNodes[i];
              if (node._prevTabindex) {
                  node.setAttribute('tabindex', node._prevTabindex);
                  node._prevTabindex = null;
              } else {
                  node.removeAttribute('tabindex');
              }
              node.style.outline = null;
          }
      }
    });
    //End Close modal on ESC key press
  
  
    };
  
    chngLang = (e) => {
      let current_url = window.location.href;
      var setLang = e.target.value
      localStorage.setItem("langButtonClicked", true);
      localStorage.setItem("lang", e.target.value)
      Cookies.set('lang', setLang, { domain: getConfig().SITE_DOMAIN[0], path: '/', secure: false, sameSite: "Lax" })
  
      if(current_url.includes('/explore-courses/explore-programs') || current_url.includes('/explore-courses/explore-topics/'))
        {
            window.location.href = window.location.origin + '/explore-courses/#main';
        }
      else {
          window.location.reload()
        }
  
  
  
      Localize.setLanguage(setLang);
      $('#langOptions > option').each(function () {
        if (setLang == $(this).val()) {
          $(this).attr('selected', true);
        } else {
          $(this).removeAttr("selected");
        }
      })
  
    }
  
    // Updated toggle handler for dropdown open/close with focus trap
  handleDropdownToggle = (e) => {
    console.log('Toggle fired from:', e.target.className || e.target.tagName, 'Active element:', document.activeElement?.className);
    e.stopPropagation();
    const userMenu = document.getElementById("user-menu");
    const isHidden = userMenu.classList.contains("hidden");
    const willOpen = isHidden;
    const toggleButtons = document.querySelectorAll(".toggle-user-dropdown");
    
    if (willOpen) {
      // alert(willOpen)
      userMenu.classList.remove("hidden");
      toggleButtons.forEach((btn) => btn.setAttribute("aria-expanded", "true"));
     
      setTimeout(() => {
        const dropdown = document.getElementById('user-menu');
        if (dropdown) {
          dropdown.addEventListener('focusout', this.handleFocusOut);
        }
      }, 0);
    } else {
      // Close: add hidden (no-op if already), set aria false, focus trigger, remove listener
      userMenu.classList.add("hidden");
      toggleButtons.forEach((btn) => btn.setAttribute("aria-expanded", "false"));
      const toggleButton = document.querySelector(".user_custom_login");
      if (toggleButton) {
        toggleButton.focus();
      }
      const dropdown = document.getElementById('user-menu');
      if (dropdown) {
        dropdown.removeEventListener('focusout', this.handleFocusOut);
      }
      this.isClosing = true;
      setTimeout(() => { this.isClosing = false; }, 50);
    }
  };
  
  handleFocusOut = (e) => {
    if (this.isClosing) return; // Keep flag for safety
    const dropdown = document.getElementById('user-menu');
    // if (!dropdown || !e.relatedTarget || dropdown.contains(e.relatedTarget)) {
    //   return; // Focus still inside or invalid target
    // }
    if (!dropdown || dropdown.classList.contains("hidden") || !e.relatedTarget || dropdown.contains(e.relatedTarget)) {
      return; // Already closed, still inside, or invalid
    }
    // Removed: Skip if focus moving to trigger (this blocked keyboard Shift+Tab)
    // Close dropdown (reuse existing close logic)
    dropdown.classList.add("hidden");
    const toggleButtons = document.querySelectorAll(".toggle-user-dropdown");
    toggleButtons.forEach((btn) => btn.setAttribute("aria-expanded", "false"));
    // Return focus to trigger button
    const toggleButton = document.querySelector(".user_custom_login");
    if (toggleButton) toggleButton.focus();
    // Clean up listener
    dropdown.removeEventListener('focusout', this.handleFocusOut);
  };
  
    render() {
      const exploreActive = window.location.href.includes('/explore-courses/') && !window.location.href.includes('/explore-courses/dashboard/');
      const dashboardActive = window.location.href.includes('/explore-courses/dashboard/');
      return (<>
        <a className="stmc" href={window.location.href.includes('/learning/course/') ? '#mx-main' : '#main'}>Skip to main content</a>
  
        <header className="global-header" id="nett-head">
          <div className="main-header">
             <HeaderLogo /> 
            <div className={`hamburger-menu ${this.state.isMobileMenuOpen ? 'open' : ''}`} role="button" aria-label="Options Menu" 
            aria-expanded={this.state.isMobileMenuOpen} 
            aria-controls="mobile-menu" tabIndex={0}
            onClick={this.toggleMobileMenu}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.toggleMobileMenu();
                  }
                }}
            >
              <span className="line"></span>
              <span className="line"></span>
              <span className="line"></span>
              <span className="line"></span>
            </div>
            <div className="nav-links">
              <div className="main">
                <nav className="navbar navbar-expand-sm   navbar-light bg-light head_menu" aria-label="primary">
                  <div className="collapse navbar-collapse" id="navbarTogglerDemo03">
                    <ul className="navbar-nav mr-auto mt-2 mt-lg-0 menu_list">
                      <li className="nav-item">
                        <a 
                          className={exploreActive ? 'active tab-nav-link' : 'tab-nav-link'} 
                          href="/explore-courses/" 
                          accessKey="c"
                          // Only adds aria-current="page" if active; nothing otherwise
                          {...(exploreActive && { 'aria-current': 'page' })}
                        >
                          Explore Courses
                        </a>
                      </li>
                      <li className="nav-item">
                        <a 
                          className={dashboardActive ? 'active tab-nav-link' : 'tab-nav-link'} 
                          href="/explore-courses/dashboard/programs" 
                          accessKey="s"
                          // Only adds aria-current="page" if active; nothing otherwise
                          {...(dashboardActive && { 'aria-current': 'page' })}
                        >
                          Dashboard
                        </a>
                      </li>
                    </ul>
                    <div className="search_box1">
                      <form className='headerSearchForm' onSubmit={this.handleSearchClick}>
                        <div className="form-group" id="headerSearchWrap" role='search'>
                          <input type="text" id="heardeSearch" value={this.state.setText} 
                          onChange={(e) => {
                            this.setState({ setText: e.target.value });
                          }}
                          name="Search for topic of interest" placeholder="Search for topic of interest" className="enter" />
                         
                          <AudioSearch
                              currentLang={Cookies.get('lang', { domain: getConfig().SITE_DOMAIN[0], path: '/', secure: false, sameSite: 'Lax' }) || 'en'}
                              onTextUpdate={(text) => this.setState({ setText: text })}
                              exploreCourseUrl={getConfig().EXPLORE_COURSE_URL[0]}
                              searchLabel="mx-header"
                            />
  
                          <input type="submit" value="" className="submit" aria-label="Search" />
                          
                        </div>
                      </form>
                    </div>
                  </div>
                </nav>
              </div>
              <div 
                className="secondary" 
                onClick={this.handleDropdownToggle}
              >
                <div className="nav-item hidden-mobile user_custom_login toggle-user-dropdown" 
                  aria-label="User Account Options"
                  aria-expanded="false" tabIndex={0} aria-controls="user-menu"
                  onClick={this.handleDropdownToggle} 
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      this.handleDropdownToggle(e);
                    }
                  }}
                 >
                  <span className="menu-title" aria-hidden="true">
                    <img className="user-image-frame" id="profileimageid" src="" alt="" />
                    <span className="sr-only" aria-disabled="true">Dashboard for:</span>
                    <span className="username" aria-disabled="true" id="header-username"></span>
                  </span>
                </div>
                <div className="nav-item hidden-mobile nav-item-dropdown">
                  <div className="toggle-user-dropdown" role="button" aria-label="Options Menu" aria-expanded="false" tabIndex={-1} aria-controls="user-menu" 
                    onClick={this.handleDropdownToggle} 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.handleDropdownToggle(e);
                      }
                    }}
                  >
                    <CaretDropDownIcon/>
                  </div>
                  <div className="dropdown-user-menu hidden" aria-label="More Options" role="menu" id="user-menu" tabIndex="-1">
                    <div className="mobile-nav-item dropdown-item dropdown-nav-item" id="dashboard-navbar"><a href="/explore-courses/dashboard/programs" role="menuitem">Dashboard</a></div>
                    <div className="mobile-nav-item dropdown-item dropdown-nav-item" ><a id="user-profiler-redirect" href="" role="menuitem">Profile</a></div>
                    <div className="mobile-nav-item dropdown-item dropdown-nav-item"><a href={getConfig().ACCOUNT_SETTINGS_URL} role="menuitem">Account</a></div>
                    <div className="mobile-nav-item dropdown-item dropdown-nav-item"><a href={getConfig().LOGOUT_URL} role="menuitem" onClick={(e) => { e.preventDefault(); window.location.href = getConfig().LOGOUT_URL; }}>Sign Out</a></div>
                  </div>
                </div>
              </div>
            </div>
  
            {/* Mobile menu  */}
                <div
                className={`mobile-menu ${this.state.isMobileMenuOpen ? '' : 'hidden'}`}
                aria-label="More"
                role="menu"
                id="mobile-menu"
              >
                {this.state.resumeCourseUrl && (
                  <div className="mobile-nav-item dropdown-item dropdown-nav-item mobile-nav-link">
                    <a href={this.state.resumeCourseUrl} role="menuitem">
                      Resume your last course
                    </a>
                  </div>
                )}
           
                <div className="mobile-nav-item dropdown-item dropdown-nav-item mobile-nav-link">
                  <a href="/explore-courses/" role="menuitem">
                    Explore Courses
                  </a>
                </div>
                <div className="mobile-nav-item dropdown-item dropdown-nav-item mobile-nav-link">
                  <a href={`${getConfig().LMS_BASE_URL}/dashboard/programs/`} role="menuitem">
                    Dashboard
                  </a>
                </div>
                <div className="mobile-nav-item dropdown-item dropdown-nav-item mobile-nav-link">
                  <a href={this.state.profileUrl} role="menuitem">
                    Profile
                  </a>
                </div>
                <div className="mobile-nav-item dropdown-item dropdown-nav-item mobile-nav-link">
                  <a href={getConfig().ACCOUNT_SETTINGS_URL} role="menuitem">
                    Account
                  </a>
                </div>
                <div className="mobile-nav-item dropdown-item dropdown-nav-item mobile-nav-link">
                  <a href={getConfig().LOGOUT_URL} role="menuitem" onClick={(e) => { e.preventDefault(); window.location.href = getConfig().LOGOUT_URL; }}>
                    Sign Out
                  </a>
                </div>
              </div>
            {/* End Mobile menu  */}
          </div>
  
        </header>
      </>
      );
    }
  }
export default Header;

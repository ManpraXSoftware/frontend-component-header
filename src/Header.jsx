import React, { Component } from 'react';
import HeaderLogo from "./header-logo";
import accessibilityIcon from './assets/accessibilityIcon.png';
import axios from 'axios';

class Header extends Component {
  componentDidMount() {
    const jf = document.createElement('script');
    jf.src = process.env.LMS_BASE_URL + '/static/js/toolkitjs/vebarl.js';
    jf.type = 'text/javascript';
    jf.id = 'external_js'
    jf.setAttribute("lms_base_url", process.env.LMS_BASE_URL)
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
    localizeKey.innerText = Localize.initialize({key: 'zKxxnKn5hZxwu',rememberLanguage: true,});
    const langSelect = document.createElement("select");
    langSelect.id = "langOptions";
    langSelect.className = "myLang";
    langSelect.ariaLabel = "Selected language";
    parentDiv.append(jf);
    parentDiv.append(jqueryScript);
    parentDiv.append(localizeInnerText);
    parentDiv.append(localizeKey);
    parentDiv.append(langSelect);
    const bodyDiv = document.body;
    bodyDiv.append(localizeScript)
    let selectTag = document.getElementById("langOptions");
    Localize.getAvailableLanguages((error, data) => {
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
        lang_name = e.name + "(Tamil (India))"
      } else if (e.code == "or") {
        lang_name = e.name + "(Odia)"
      } else if (e.code == "ml-IN" || e.code == "ml") {
        lang_name = e.name + "(Malayalam)"
      }
      var newOption = new Option(lang_name, e.code)
      selectTag.append(newOption)
      })
    });
    axios.get(process.env.LMS_BASE_URL + '/mx-user-info/get_user_profile').then((res) => {
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
            name = name + "(Tamil (India))"
          } else if (code == "or") {
            name = name + "(Odia)"
          } else if (code == "ml-IN" || code == "ml") {
            name = name + "(Malayalam)"
          }
          var option = new Option(name, code)
          selectTag.append(option)
        }
      }
    })

  }
  
  render() {
  
    return (<>
      <div className="uai userway_dark"  id="userwayAccessibilityIcon" aria-label="accessibility menu" role="button" tabIndex={1} >
        <img alt="Accessibility Widget" src={accessibilityIcon} className="ui_w" width="35" height="35" />
      </div>
      <header className="global-header" id="nett-head">
        <div className="main-header">
          <HeaderLogo />
          <div className="hamburger-menu" role="button" aria-label="Options Menu" aria-expanded={false} aria-controls="mobile-menu" tabIndex={0}>
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
                      <a className={window.location.href.includes('/explore-courses/') ? 'active tab-nav-link' : 'tab-nav-link'} href="/explore-courses/" accessKey="c"
                        aria-current="page">Explore Courses</a>
                    </li>
                    <li className="nav-item">
                      <a className={window.location.href.includes('dashboard/programs/') ? 'active tab-nav-link' : 'tab-nav-link'} href={process.env.LMS_BASE_URL + 'dashboard/programs/'} accessKey="s"
                        aria-current="page">
                        Dashboard
                      </a>
                    </li>
                  </ul>
                  <div className="search_box">
                    <form className='headerSearchForm' onSubmit={(e) => { e.preventDefault() }}>
                      <div className="form-group" role='search'>
                        <input type="text" id="heardeSearch" name="Search for topic of interest" placeholder="Search for topic of interest" className="enter" onChange={(e) => { }} />
                        <input type="submit" value="" className="submit" aria-label="Search" />
                      </div>
                    </form>
                  </div>
                </div>
              </nav>
            </div>
            <div className="secondary" onClick={(e) => { document.getElementById("user-menu").classList.toggle("hidden") }}>
              <div className="nav-item hidden-mobile user_custom_login toggle-user-dropdown" aria-label="User Account Options" aria-expanded="false" tabIndex={0} aria-controls="user-menu">
                <span className="menu-title" aria-hidden="true">
                  <img className="user-image-frame" id="profileimageid" src="" alt="" />
                  <span className="sr-only" aria-disabled="true">Dashboard for:</span>
                  <span className="username" aria-disabled="true" id="header-username"></span>
                </span>
              </div>
              <div className="nav-item hidden-mobile nav-item-dropdown">
                <div className="toggle-user-dropdown" role="button" aria-label="Options Menu" aria-expanded="false" tabIndex={-1} aria-controls="user-menu">
                  <span className="fa fa-caret-down" aria-hidden="true"></span>
                </div>
                <div className="dropdown-user-menu hidden" aria-label="More Options" role="menu" id="user-menu" tabIndex={-1}>
                  <div className="mobile-nav-item dropdown-item dropdown-nav-item" id="dashboard-navbar"><a href={process.env.LMS_BASE_URL + 'dashboard/programs/'} role="menuitem">Dashboard</a></div>
                  <div className="mobile-nav-item dropdown-item dropdown-nav-item" ><a id="user-profiler-redirect" href="" role="menuitem">Profile</a></div>
                  <div className="mobile-nav-item dropdown-item dropdown-nav-item"><a href={process.env.LMS_BASE_URL + 'account/settings'} role="menuitem">Account</a></div>
                  <div className="mobile-nav-item dropdown-item dropdown-nav-item"><a href={process.env.LMS_BASE_URL + 'logout'} role="menuitem">Sign Out</a></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
    );
  }
}

export default Header;

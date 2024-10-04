import React from "react";
import logo from "../assets/logo.png";

const HeaderLogo = ()=>{
    return (<span className="header-logo">
        <a href={process.env.LMS_BASE_URL+'dashboard/programs/'} style={{margin:"7px"}}>
        <img  className="logo" src={logo} alt="Subodha Home Page"/>
        </a>
    </span>)
}

export default HeaderLogo;
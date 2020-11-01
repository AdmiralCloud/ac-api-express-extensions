<a name="0.1.9"></a>

## [0.1.9](https://github.com/mmpro/ac-api-express-extensions/compare/v0.1.8..v0.1.9) (2020-11-01 11:10:05)


### Bug Fix

* **sanitizer:** Range can be a function, required condition can be a value | MP | [a6347203cc643d8c137039267aee620a84084a1a](https://github.com/mmpro/ac-api-express-extensions/commit/a6347203cc643d8c137039267aee620a84084a1a)    
Use rangeDef if you want to use a function (e.g. timestamp) as range. Required for can now have a value to check for as requirement condition.
<a name="0.1.8"></a>

## [0.1.8](https://github.com/mmpro/ac-api-express-extensions/compare/v0.1.7..v0.1.8) (2020-10-31 16:29:08)


### Bug Fix

* **apidocRoute:** Add optional path parameter  | MP | [668b3a599d276de4f1c269747d7596f5fa45711f](https://github.com/mmpro/ac-api-express-extensions/commit/668b3a599d276de4f1c269747d7596f5fa45711f)    
If controller name does not match path (e.g. DownloadLogsController vs /download) you can now set the path manually.
<a name="0.1.7"></a>

## [0.1.7](https://github.com/mmpro/ac-api-express-extensions/compare/v0.1.6..v0.1.7) (2020-10-27 13:24:09)


### Bug Fix

* **sanitizer:** Use requiredFor on all object levels | MP | [4ef062e5023938b8f4b1b5adaf02dacef6321217](https://github.com/mmpro/ac-api-express-extensions/commit/4ef062e5023938b8f4b1b5adaf02dacef6321217)    
Use requiredFor on all object levels to determine requirement
### Chores

* **Misc:** Updated packages | MP | [9111bb964e3b1d905aa92b6a46dca29f1746b9c7](https://github.com/mmpro/ac-api-express-extensions/commit/9111bb964e3b1d905aa92b6a46dca29f1746b9c7)    
Updated packages
<a name="0.1.6"></a>

## [0.1.6](https://github.com/mmpro/ac-api-express-extensions/compare/v0.1.5..v0.1.6) (2020-10-17 15:12:44)


### Bug Fix

* **sanitizer:** Added date | MP | [2675623fe5fcf86ed39ce4c46e3e39bb6fd516a2](https://github.com/mmpro/ac-api-express-extensions/commit/2675623fe5fcf86ed39ce4c46e3e39bb6fd516a2)    
Added date
<a name="0.1.5"></a>

## [0.1.5](https://github.com/mmpro/ac-api-express-extensions/compare/v0.1.4..v0.1.5) (2020-10-17 14:15:45)


### Bug Fix

* **sanitizer:** Add RGB, hexColor and ratio | MP | [cfc4a0aa7470e8447e23a6007b3f60c73d10e482](https://github.com/mmpro/ac-api-express-extensions/commit/cfc4a0aa7470e8447e23a6007b3f60c73d10e482)    
Add RGB, hexColor and ratio
<a name="0.1.4"></a>

## [0.1.4](https://github.com/mmpro/ac-api-express-extensions/compare/v0.1.3..v0.1.4) (2020-10-17 13:24:21)


### Bug Fix

* **sanitizer:** Sanitizer now supports gps | MP | [6f7606be8bfd199ce7ea94787e7a321f52997699](https://github.com/mmpro/ac-api-express-extensions/commit/6f7606be8bfd199ce7ea94787e7a321f52997699)    
Sanitizer now supports gps
<a name="0.1.3"></a>

## [0.1.3](https://github.com/mmpro/ac-api-express-extensions/compare/v0.1.2..v0.1.3) (2020-10-01 09:45:12)


### Bug Fix

* **apidocRoute:** Minor fix if route action is not available | MP | [36bc8675ffcc46b0b0f4324240d5cc47ad07f120](https://github.com/mmpro/ac-api-express-extensions/commit/36bc8675ffcc46b0b0f4324240d5cc47ad07f120)    
Minor fix if route action is not available yet
### Chores

* **Misc:** Updated packages | MP | [5bcf014b889dc58db7982b4bc0c0442b3413a267](https://github.com/mmpro/ac-api-express-extensions/commit/5bcf014b889dc58db7982b4bc0c0442b3413a267)    
Updated packages
<a name="0.1.2"></a>

## [0.1.2](https://github.com/mmpro/ac-api-express-extensions/compare/v0.1.1..v0.1.2) (2020-09-01 13:57:41)


### Bug Fix

* **Misc:** Improved handling of required for in apidocs | MP | [6442cb0e0dcd683fc272121a533cd0de0407c0b9](https://github.com/mmpro/ac-api-express-extensions/commit/6442cb0e0dcd683fc272121a533cd0de0407c0b9)    
conditions in requiredFor is now an object with properties field and optional op(eration).
### Chores

* **Misc:** Updated packages | MP | [e24cb945834b9cac8915128f4a2dfff44bb245d3](https://github.com/mmpro/ac-api-express-extensions/commit/e24cb945834b9cac8915128f4a2dfff44bb245d3)    
Updated packages
<a name="0.1.1"></a>

## [0.1.1](https://github.com/mmpro/ac-api-express-extensions/compare/v0.1.0..v0.1.1) (2020-08-22 17:43:09)


### Bug Fix

* **sanitizer:** Add defaultsTo value if no value is set | MP | [8fde551c0d64e6dfe3bb99c622920ac93d67ddd2](https://github.com/mmpro/ac-api-express-extensions/commit/8fde551c0d64e6dfe3bb99c622920ac93d67ddd2)    
Add defaultsTo value if no value is set
### Chores

* **Misc:** Updated packages | MP | [adc42e1956248e6527fa76906bee21757b6ea605](https://github.com/mmpro/ac-api-express-extensions/commit/adc42e1956248e6527fa76906bee21757b6ea605)    
Updated packages
<a name="0.1.0"></a>
 
# [0.1.0](https://github.com/mmpro/ac-api-express-extensions/compare/..v0.1.0) (2020-08-16 10:09:30)


### Feature

* **Misc:** Initial version of this package | MP | [1b73d63ca4e6b0b4a8f0594117a4dbd8bbdeb75a](https://github.com/mmpro/ac-api-express-extensions/commit/1b73d63ca4e6b0b4a8f0594117a4dbd8bbdeb75a)    
Initial version of this package
### Bug Fix

* **apidocRoute:** Never cache apidocs | MP | [20ab8e8ed773c5a478694fb4a452155e18d0c142](https://github.com/mmpro/ac-api-express-extensions/commit/20ab8e8ed773c5a478694fb4a452155e18d0c142)    
Never cache apidocs by setting the appropriate header
### Chores

* **Misc:** Updated packages | MP | [b63dab07846dd908d0df64104729c660dbd25ff7](https://github.com/mmpro/ac-api-express-extensions/commit/b63dab07846dd908d0df64104729c660dbd25ff7)    
Updated packages
undefined